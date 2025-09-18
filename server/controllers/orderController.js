const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { clearDashboardCache } = require("./dashboardController");
const {
  serializeOrderForAdmin,
  serializeOrderForUser,
} = require("./orderSerializers");

const {
  emitVariantOutOfStockAlertIfNeeded,
  emitVariantLowStockAlertIfNeeded,
} = require("../utils/stockAlerts");

// Clave lógica de ítem (para comparar por variante)
const itemKey = (i) =>
  `${String(i.product)}::${String(i.size || "")}::${String(i.color || "")}`;

// Precio efectivo del producto (usa método del modelo si existe)
function effectivePrice(product) {
  try {
    if (typeof product.getEffectivePrice === "function") {
      return Number(product.getEffectivePrice()) || Number(product.price) || 0;
    }
    return Number(product.price) || 0;
  } catch {
    return Number(product.price) || 0;
  }
}

/** ========================== CREATE (sin transacciones) ==========================
 *  - Sin usar $gte en filtros de update.
 *  - Decrementa con $inc y luego verifica que no quedó negativo.
 *  - Idempotencia opcional vía header "Idempotency-Key" o body.idempotencyKey
 *    (para deduplicar doble clics / reintentos desde el front).
 */
exports.createOrder = async (req, res) => {
  const compensations = [];
  try {
    const { items, shippingInfo } = req.body;

    // Idempotencia (opcional pero recomendado)
    const idempotencyKey =
      (req.get("Idempotency-Key") || req.body?.idempotencyKey || "").trim() ||
      null;

    if (idempotencyKey) {
      const existing = await Order.findOne({
        user: req.user.id,
        idempotencyKey,
      });
      if (existing) {
        return res.status(200).json({
          orderId: existing._id,
          order: serializeOrderForUser(existing),
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Debes incluir al menos un producto" });
    }

    // Normaliza/valida payload + castea a ObjectId
    const normalizedItems = [];
    for (const item of items) {
      const productId = String(item.product || "").trim();
      const sizeId = String(item.size || "").trim();
      const colorId = String(item.color || "").trim();
      const qty = Math.max(1, Math.floor(Number(item.quantity || 0)));

      if (!productId || !sizeId || !colorId || qty <= 0) {
        return res
          .status(400)
          .json({ error: "Datos inválidos en uno de los ítems" });
      }
      if (
        !mongoose.Types.ObjectId.isValid(productId) ||
        !mongoose.Types.ObjectId.isValid(sizeId) ||
        !mongoose.Types.ObjectId.isValid(colorId)
      ) {
        return res
          .status(400)
          .json({ error: "IDs inválidos en uno de los ítems" });
      }

      normalizedItems.push({
        product: new mongoose.Types.ObjectId(productId),
        size: new mongoose.Types.ObjectId(sizeId),
        color: new mongoose.Types.ObjectId(colorId),
        quantity: qty,
      });
    }

    // Deduplicar líneas por variante sumando cantidades
    const dedup = new Map();
    for (const it of normalizedItems) {
      const key = itemKey(it);
      const prev = dedup.get(key);
      if (prev) prev.quantity += it.quantity;
      else dedup.set(key, { ...it });
    }
    const itemsToProcess = Array.from(dedup.values());

    // Proceso ítem por ítem con decremento + verificación + posible rollback
    let total = 0;
    const itemsToSave = [];

    for (const it of itemsToProcess) {
      // 1) Traer solo la variante exacta (NO usamos $gte en ningún lado)
      const prodDoc = await Product.findOne(
        {
          _id: it.product,
          "variants.size": it.size,
          "variants.color": it.color,
        },
        { name: 1, price: 1, discount: 1, "variants.$": 1 }
      ).lean();

      if (!prodDoc || !prodDoc.variants || !prodDoc.variants[0]) {
        throw new Error("Variante no disponible para el producto seleccionado");
      }

      const variant = prodDoc.variants[0];
      const stockBefore = Number(variant.stock) || 0;

      if (stockBefore < it.quantity) {
        throw new Error(
          `Stock insuficiente para ${prodDoc.name}. Disponible: ${stockBefore}`
        );
      }

      // 2) Decremento SIN $gte (evita problemas de casteo y tipos en DB)
      const dec = await Product.updateOne(
        {
          _id: it.product,
          "variants.size": it.size,
          "variants.color": it.color,
        },
        { $inc: { "variants.$.stock": -it.quantity } }
      );

      if (!dec.modifiedCount) {
        throw new Error(`Stock insuficiente (carrera) para ${prodDoc.name}.`);
      }

      // 3) Verificar que no haya quedado negativo; si queda < 0, revertimos inmediatamente
      const checkDoc = await Product.findOne(
        {
          _id: it.product,
          "variants.size": it.size,
          "variants.color": it.color,
        },
        { name: 1, "variants.$": 1 }
      ).lean();

      const stockAfter = Number(checkDoc?.variants?.[0]?.stock) || 0;
      if (stockAfter < 0) {
        await Product.updateOne(
          {
            _id: it.product,
            "variants.size": it.size,
            "variants.color": it.color,
          },
          { $inc: { "variants.$.stock": it.quantity } }
        );
        throw new Error(`Stock insuficiente (carrera) para ${prodDoc.name}.`);
      }

      // 4) Registrar compensación por si falla otro ítem más adelante
      compensations.push({
        product: it.product,
        size: it.size,
        color: it.color,
        qty: it.quantity,
      });

      // 5) Precio unitario (aplica descuento si el modelo lo calcula)
      const unitPrice = effectivePrice(prodDoc);
      total += unitPrice * it.quantity;

      itemsToSave.push({
        product: it.product,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
        unitPrice,
        stockBeforePurchase: stockBefore,
        stockAtPurchase: stockAfter,
      });
    }

    // 6) Crear la orden
    const order = await Order.create({
      user: req.user.id,
      idempotencyKey: idempotencyKey || null, // <- se guarda si viene
      items: itemsToSave,
      total: Number(total.toFixed(2)),
      status: "pendiente",
      shippingInfo: shippingInfo && {
        fullName: String(shippingInfo.fullName || ""),
        phone: String(shippingInfo.phone || ""),
        address: String(shippingInfo.address || ""),
        city: String(shippingInfo.city || ""),
        notes: String(shippingInfo.notes || ""),
      },
    });

    // ---------- NUEVO: Emitir alerta de stock si corresponde ----------
    // Llamamos por cada producto procesado para crear/actualizar una alerta
    for (const it of itemsToProcess) {
      try {
        // Logs opcionales para depurar
        console.log("[Alerta] Verificando variante", {
          product: String(it.product),
          size: String(it.size),
          color: String(it.color),
        });

        await emitVariantOutOfStockAlertIfNeeded(it.product, it.size, it.color);
        await emitVariantLowStockAlertIfNeeded(it.product, it.size, it.color);
        console.log("[Alerta] Verificación completa mirando si van datos en ", emitVariantOutOfStockAlertIfNeeded, emitVariantLowStockAlertIfNeeded);
      } catch (e) {
        console.warn("emitVariant... error:", e?.message || e);
      }
    }
    // -----------------------------------------------------------------

    clearDashboardCache();
    return res
      .status(201)
      .json({ orderId: order._id, order: serializeOrderForUser(order) });
  } catch (err) {
    // COMPENSACIÓN: restituye todo lo decrementado si falló algo
    for (const c of compensations) {
      try {
        await Product.updateOne(
          {
            _id: c.product,
            "variants.size": c.size,
            "variants.color": c.color,
          },
          { $inc: { "variants.$.stock": c.qty } }
        );
      } catch (_) {}
    }

    console.error("Error en createOrder:", err);
    return res
      .status(400)
      .json({ error: err.message || "Error al procesar pedido" });
  }
};

/** ========================== READ (USUARIO) ========================== */
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({ path: "items.product", select: "name price" })
      .populate({ path: "items.size", select: "label" })
      .populate({ path: "items.color", select: "name" })
      .sort({ createdAt: -1 });

    res.json(orders.map(serializeOrderForUser));
  } catch (err) {
    console.error("Error al obtener pedidos:", err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
};

/** ========================== READ (ADMIN) ========================== */
exports.getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate("user", "name email")
      .populate({ path: "items.product", select: "name price" })
      .populate({ path: "items.size", select: "label" })
      .populate({ path: "items.color", select: "name" })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Error getAllOrders:", err);
    res.status(500).json({ error: err.message });
  }
};

/** ========================== UPDATE STATUS (ADMIN) ========================== */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = [
      "pendiente",
      "facturado",
      "enviado",
      "entregado",
      "cancelado",
    ];
    if (!allowed.includes(String(status))) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    const prevStatus = order.status;
    order.status = String(status);

    // Consideramos "facturado" como "pago confirmado"
    const becomesPaid = status === "facturado";

    // Sólo incrementar una vez en la vida de la orden
    if (becomesPaid && !order.wasCountedForBestsellers) {
      for (const item of order.items) {
        if (item.product && item.quantity > 0) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { salesCount: Number(item.quantity) || 0 } }
          );
        }
      }
      order.wasCountedForBestsellers = true;
    }

    await order.save();

    return res.json({
      message: "Estado actualizado correctamente",
      order,
      prevStatus,
      incrementedBestSellers: becomesPaid && order.wasCountedForBestsellers,
    });
  } catch (err) {
    console.error("Error al actualizar estado del pedido:", err);
    return res
      .status(500)
      .json({ error: "Error al actualizar estado del pedido" });
  }
};

/** ========================== READ BY admin user ========================== */
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "email name")
      .populate({ path: "items.product", select: "name price" })
      .populate({ path: "items.size", select: "label" })
      .populate({ path: "items.color", select: "name" });

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    return res.json(serializeOrderForAdmin(order));
  } catch (err) {
    console.error("Error getOrderById:", err);
    res.status(500).json({ error: "Error al obtener el pedido" });
  }
};

exports.getMyOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Order.findById(id)
      .populate({ path: "items.product", select: "name price" })
      .populate({ path: "items.size", select: "label" })
      .populate({ path: "items.color", select: "name" });

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (String(order.user) !== String(req.user.id)) {
      return res.status(403).json({ error: "No autorizado" });
    }

    return res.json(serializeOrderForUser(order));
  } catch (err) {
    console.error("Error getMyOrderById:", err);
    res.status(500).json({ error: "Error al obtener el pedido" });
  }
};

/** ========================== UPDATE (ADMIN) ========================== */
exports.updateOrder = async (req, res) => {
  const { id } = req.params;
  const {
    status,
    items,
    trackingNumber,
    shippingCompany,
    adminComment,
    shippingInfo,
  } = req.body;

  try {
    // Si NO hay cambios de items y SÍ hay cambios de metadatos → update simple SIN transacción
    const isItemsChange = Array.isArray(items);
    const isMetaChange =
      typeof status !== "undefined" ||
      typeof trackingNumber !== "undefined" ||
      typeof shippingCompany !== "undefined" ||
      typeof adminComment !== "undefined" ||
      (shippingInfo && typeof shippingInfo === "object");

    if (!isItemsChange && isMetaChange) {
      const $set = {};

      if (typeof status !== "undefined") $set.status = status;
      if (typeof trackingNumber !== "undefined")
        $set.trackingNumber = String(trackingNumber || "");
      if (typeof shippingCompany !== "undefined")
        $set.shippingCompany = String(shippingCompany || "");
      if (typeof adminComment !== "undefined")
        $set.adminComment = String(adminComment || "");

      if (shippingInfo && typeof shippingInfo === "object") {
        if ("fullName" in shippingInfo)
          $set["shippingInfo.fullName"] = String(shippingInfo.fullName || "");
        if ("phone" in shippingInfo)
          $set["shippingInfo.phone"] = String(shippingInfo.phone || "");
        if ("address" in shippingInfo)
          $set["shippingInfo.address"] = String(shippingInfo.address || "");
        if ("city" in shippingInfo)
          $set["shippingInfo.city"] = String(shippingInfo.city || "");
        if ("notes" in shippingInfo)
          $set["shippingInfo.notes"] = String(shippingInfo.notes || "");
      }

      const updated = await Order.findByIdAndUpdate(
        id,
        { $set },
        { new: true }
      );
      if (!updated)
        return res.status(404).json({ error: "Pedido no encontrado" });

      clearDashboardCache();
      return res.json({ message: "Pedido actualizado", order: updated });
    }

    if (!isItemsChange && !isMetaChange) {
      return res.status(400).json({ error: "No hay cambios para aplicar" });
    }

    // ==== A partir de aquí: cambios de ITEMS → usar transacción (requiere replica set) ====
    const session = await mongoose.startSession();
    try {
      const order = await Order.findById(id);
      if (!order)
        return res.status(404).json({ error: "Pedido no encontrado" });

      await session.withTransaction(async () => {
        const prevItems = order.items.map((i) => ({
          product: String(i.product),
          size: String(i.size || ""),
          color: String(i.color || ""),
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unitPrice) || 0,
          stockBeforePurchase:
            typeof i.stockBeforePurchase === "number"
              ? i.stockBeforePurchase
              : null,
          stockAtPurchase:
            typeof i.stockAtPurchase === "number" ? i.stockAtPurchase : null,
        }));
        const prevMap = new Map(prevItems.map((i) => [itemKey(i), i]));

        const nextItems = Array.isArray(items) ? items : null;
        const normalizedNext = [];

        if (nextItems) {
          for (const it of nextItems) {
            const productId = it.product;
            const sizeId = it.size;
            const colorId = it.color;
            const qty = Number(it.quantity) || 0;

            if (!productId || !sizeId || !colorId || qty <= 0) {
              throw new Error("Datos incompletos o inválidos en los ítems");
            }

            const product = await Product.findById(productId).session(session);
            if (!product) throw new Error("Producto no encontrado");

            const vIndex = product.variants.findIndex(
              (v) =>
                String(v.size) === String(sizeId) &&
                String(v.color) === String(colorId)
            );
            if (vIndex === -1)
              throw new Error(
                `Variante no disponible (producto: ${product.name})`
              );

            const key = `${String(productId)}::${String(sizeId)}::${String(
              colorId
            )}`;
            const prev = prevMap.get(key);
            const prevQty = prev ? prev.quantity : 0;
            const diff = qty - prevQty;

            const currentStock = Number(product.variants[vIndex].stock) || 0;
            if (diff > 0 && currentStock < diff) {
              throw new Error(
                `Stock insuficiente para ${product.name}. Falta: ${
                  diff - currentStock
                }`
              );
            }

            // Snapshots si es ítem nuevo o faltaban
            let stockBeforePurchase = prev?.stockBeforePurchase ?? null;
            let stockAtPurchase = prev?.stockAtPurchase ?? null;

            if (!prev) {
              const stockBefore = currentStock;
              const stockAfter = currentStock - diff; // diff > 0
              stockBeforePurchase = stockBefore;
              stockAtPurchase = stockAfter;
            } else if (prev && typeof stockAtPurchase !== "number") {
              const stockBefore = currentStock;
              const stockAfter = currentStock - diff;
              stockBeforePurchase = stockBefore;
              stockAtPurchase = stockAfter;
            }

            normalizedNext.push({
              productId,
              sizeId,
              colorId,
              qty,
              vIndex,
              product,
              prev,
              diff,
              currentStock,
              computedSnapshots: { stockBeforePurchase, stockAtPurchase },
            });
          }

          // Aplica ajuste de stock
          for (const n of normalizedNext) {
            if (n.diff !== 0) {
              const nextStock = n.currentStock - n.diff;
              if (nextStock < 0)
                throw new Error(`Stock insuficiente para ${n.product.name}`);
              n.product.variants[n.vIndex].stock = nextStock;
              await n.product.save({ session });
            }
          }

          // ---------- NUEVO: Emitir alertas de stock tras actualizar ítems ----------
          // Emitimos por cada producto afectado para crear/actualizar alerta
          for (const n of normalizedNext) {
            try {
              const pid = n.productId || (n.product && n.product._id);
              if (pid) {
                console.log("[Alerta] Verificando variante order (update)", {
                  product: String(pid),
                  size: String(n.sizeId),
                  color: String(n.colorId),
                });

                await emitVariantOutOfStockAlertIfNeeded(
                  pid,
                  n.sizeId,
                  n.colorId
                );
                await emitVariantLowStockAlertIfNeeded(
                  pid,
                  n.sizeId,
                  n.colorId
                );
              }
            } catch (e) {
              console.warn("emitVariant... (update) error:", e?.message || e);
            }
          }
          // -----------------------------------------------------------------------

          // Reconstruye items preservando unitPrice/snapshots previos
          const rebuilt = [];
          for (const n of normalizedNext) {
            const key = `${String(n.productId)}::${String(n.sizeId)}::${String(
              n.colorId
            )}`;
            const prev = prevMap.get(key);

            const unitPrice = prev
              ? Number(prev.unitPrice)
              : effectivePrice(n.product);
            const stockBeforePurchase =
              prev && typeof prev.stockBeforePurchase === "number"
                ? prev.stockBeforePurchase
                : n.computedSnapshots.stockBeforePurchase;

            const stockAtPurchase =
              prev && typeof prev.stockAtPurchase === "number"
                ? prev.stockAtPurchase
                : n.computedSnapshots.stockAtPurchase;

            rebuilt.push({
              product: n.productId,
              size: n.sizeId,
              color: n.colorId,
              quantity: n.qty,
              unitPrice,
              stockBeforePurchase,
              stockAtPurchase,
            });
          }

          order.items = rebuilt;
        }

        // Campos adicionales
        if (typeof status !== "undefined") order.status = status;
        if (typeof trackingNumber !== "undefined")
          order.trackingNumber = String(trackingNumber || "");
        if (typeof shippingCompany !== "undefined")
          order.shippingCompany = String(shippingCompany || "");
        if (typeof adminComment !== "undefined")
          order.adminComment = String(adminComment || "");

        if (shippingInfo && typeof shippingInfo === "object") {
          if ("fullName" in shippingInfo)
            order.shippingInfo = {
              ...(order.shippingInfo || {}),
              fullName: String(shippingInfo.fullName || ""),
            };
          if ("phone" in shippingInfo)
            order.shippingInfo = {
              ...(order.shippingInfo || {}),
              phone: String(shippingInfo.phone || ""),
            };
          if ("address" in shippingInfo)
            order.shippingInfo = {
              ...(order.shippingInfo || {}),
              address: String(shippingInfo.address || ""),
            };
          if ("city" in shippingInfo)
            order.shippingInfo = {
              ...(order.shippingInfo || {}),
              city: String(shippingInfo.city || ""),
            };
          if ("notes" in shippingInfo)
            order.shippingInfo = {
              ...(order.shippingInfo || {}),
              notes: String(shippingInfo.notes || ""),
            };
        }

        // Recalcula total
        let newTotal = 0;
        for (const it of order.items) {
          if (typeof it.unitPrice !== "number") {
            const prod = await Product.findById(it.product).session(session);
            it.unitPrice = effectivePrice(prod);
          }
          newTotal += Number(it.unitPrice) * Number(it.quantity);
        }
        order.total = Number(newTotal.toFixed(2));

        await order.save({ session });

        clearDashboardCache();
        res.json({ message: "Pedido actualizado con control de stock", order });
      });
    } catch (txErr) {
      console.error("Error actualizando pedido (transacción):", txErr);
      return res
        .status(400)
        .json({ error: txErr.message || "Error al actualizar pedido" });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error actualizando pedido:", error);
    return res
      .status(400)
      .json({ error: error.message || "Error al actualizar pedido" });
  }
};

/** ========================== CANCEL ========================== */
exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    if (order.status !== "pendiente") {
      return res
        .status(400)
        .json({ error: "Solo pedidos 'pendiente' pueden cancelarse" });
    }

    await session.withTransaction(async () => {
      for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) continue;

        const vIndex = product.variants.findIndex(
          (v) =>
            String(v.size) === String(item.size) &&
            String(v.color) === String(item.color)
        );
        if (vIndex !== -1) {
          const current = Number(product.variants[vIndex].stock) || 0;
          product.variants[vIndex].stock = current + Number(item.quantity);
          await product.save({ session });
        }
      }

      order.status = "cancelado";
      await order.save({ session });

      clearDashboardCache();

      res.json({ message: "Pedido cancelado y stock restablecido", order });
    });
  } catch (err) {
    console.error("Error al cancelar pedido:", err);
    res.status(500).json({ error: "Error al cancelar el pedido" });
  } finally {
    session.endSession();
  }
};

/** ========================== UTILS/REPORTS ========================== */
exports.getAllOrderIds = async (req, res) => {
  try {
    const orders = await Order.find({}, "_id").sort({ createdAt: -1 });
    res.json(orders.map((o) => o._id));
  } catch (err) {
    console.error("Error getAllOrderIds:", err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
};

exports.getGlobalSalesHistory = async (req, res) => {
  try {
    const {
      from,
      to,
      status,
      productId,
      userId,
      sizeId,
      colorId,
      limit = 1000,
    } = req.query;

    const match = {};
    if (status) match.status = status;

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      match.user = new mongoose.Types.ObjectId(userId);
    }

    const pipeline = [{ $match: match }, { $unwind: "$items" }];

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      pipeline.push({
        $match: { "items.product": new mongoose.Types.ObjectId(productId) },
      });
    }
    if (sizeId && mongoose.Types.ObjectId.isValid(sizeId)) {
      pipeline.push({
        $match: { "items.size": new mongoose.Types.ObjectId(sizeId) },
      });
    }
    if (colorId && mongoose.Types.ObjectId.isValid(colorId)) {
      pipeline.push({
        $match: { "items.color": new mongoose.Types.ObjectId(colorId) },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "sizes",
          localField: "items.size",
          foreignField: "_id",
          as: "sizeDoc",
        },
      },
      { $unwind: { path: "$sizeDoc", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "colors",
          localField: "items.color",
          foreignField: "_id",
          as: "colorDoc",
        },
      },
      { $unwind: { path: "$colorDoc", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          unitPrice: { $toDouble: { $ifNull: ["$items.unitPrice", 0] } },
          quantity: { $toInt: { $ifNull: ["$items.quantity", 0] } },
          stockAtPurchase: { $ifNull: ["$items.stockAtPurchase", null] },
        },
      },
      { $addFields: { total: { $multiply: ["$unitPrice", "$quantity"] } } },

      {
        $project: {
          _id: 0,
          orderId: "$_id",
          date: "$createdAt",
          status: 1,
          userId: "$user",
          userName: { $ifNull: ["$userDoc.name", "Desconocido"] },

          productId: "$items.product",
          productName: { $ifNull: ["$productDoc.name", "Producto eliminado"] },

          sizeId: "$items.size",
          sizeLabel: { $ifNull: ["$sizeDoc.label", "Desconocido"] },

          colorId: "$items.color",
          colorName: { $ifNull: ["$colorDoc.name", "Desconocido"] },

          unitPrice: 1,
          quantity: 1,
          total: 1,
          stockAtPurchase: 1,
        },
      },
      { $sort: { date: -1 } },
      { $limit: Math.min(Number(limit) || 1000, 5000) }
    );

    const rows = await Order.aggregate(pipeline);
    return res.json(rows || []);
  } catch (err) {
    console.error("Error getGlobalSalesHistory:", err);
    return res
      .status(500)
      .json({ error: "Error al obtener historial general de ventas" });
  }
};
