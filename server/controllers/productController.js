const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const ProductAudit = require("../models/ProductAudit");
const ProductEntryHistory = require("../models/ProductEntryHistory");
const ProductVariantLedger = require("../models/ProductVariantLedger");
const Size = require("../models/Size");
const Color = require("../models/Color");
const Order = require("../models/Order");

/** Normaliza category a UN solo ObjectId (si te llega array o CSV, toma el primero) */
function normalizeCategory(categories) {
  if (!categories) return undefined;
  if (Array.isArray(categories)) return categories[0];
  if (typeof categories === "string") {
    const parts = categories
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts[0] || categories;
  }
  return categories;
}

/** Parsea variantes desde string o array y valida estructura mínima */
function parseVariants(raw) {
  let arr = [];
  if (!raw) return arr;
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    arr = [];
  }

  /* Logica para sku  */
  const list = (Array.isArray(arr) ? arr : []).filter(
    (v) => v && v.size && v.color && Number(v.stock) >= 0
  );
  // Evitar duplicados size+color
  const seen = new Set();
  const out = [];
  for (const v of list) {
    const k = keyOf(v.size, v.color);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/* Logica para sku para manera duplicados */
function isDuplicateVariants(raw) {
  const seen = new Set();
  for (const v of raw) {
    const k = keyOf(v.size, v.color);
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

/** Clave lógica de variante */
function keyOf(sizeId, colorId) {
  return `${String(sizeId)}::${String(colorId)}`;
}

/** Snapshots de etiquetas para no depender de populate a futuro */
async function getVariantSnapshots(sizeId, colorId) {
  let sizeLabel = "Desconocido";
  let colorName = "Desconocido";
  try {
    const [s, c] = await Promise.all([
      Size.findById(sizeId).lean(),
      Color.findById(colorId).lean(),
    ]);
    if (s?.label) sizeLabel = s.label;
    if (c?.name) colorName = c.name;
  } catch {}
  return { sizeLabel, colorName };
}

/** ---- Helpers de descuento ---- */
function parseDiscountFromBody(body) {
  // Caso 1: todo el descuento viene en un único campo JSON (FormData)
  if (body.discount != null) {
    try {
      const raw =
        typeof body.discount === "string"
          ? JSON.parse(body.discount)
          : body.discount;
      return {
        enabled: !!raw.enabled,
        type: raw.type === "FIXED" ? "FIXED" : "PERCENT",
        value: Number(raw.value) || 0,
        startAt: raw.startAt ? new Date(raw.startAt) : null,
        endAt: raw.endAt ? new Date(raw.endAt) : null,
        _source: "json",
      };
    } catch {
      return { _error: "Formato JSON inválido en discount" };
    }
  }

  // Caso 2: campos planos (discount[enabled], etc.) — validados por express-validator en rutas
  const hasAnyFlat =
    body["discount[enabled]"] != null ||
    body["discount[type]"] != null ||
    body["discount[value]"] != null ||
    body["discount[startAt]"] != null ||
    body["discount[endAt]"] != null;

  if (hasAnyFlat) {
    const enabled = String(body["discount[enabled]"]).trim() === "true";
    const type = body["discount[type]"] === "FIXED" ? "FIXED" : "PERCENT";
    const value = Number(body["discount[value]"]) || 0;
    const startAt = body["discount[startAt]"]
      ? new Date(body["discount[startAt]"])
      : null;
    const endAt = body["discount[endAt]"]
      ? new Date(body["discount[endAt]"])
      : null;
    return { enabled, type, value, startAt, endAt, _source: "flat" };
  }

  return null; // No se envió descuento en el request
}

function validateDiscountPayload(priceNumber, d) {
  if (!d || !d.enabled) {
    // Si viene null o disabled, normalizamos a disabled
    return {
      ok: true,
      value: {
        enabled: false,
        type: "PERCENT",
        value: 0,
        startAt: null,
        endAt: null,
      },
    };
  }
  if (d.type === "PERCENT") {
    if (!(d.value > 0 && d.value <= 90)) {
      return { ok: false, error: "Porcentaje inválido (1–90%)." };
    }
  } else {
    const p = Number(priceNumber) || 0;
    if (!(d.value > 0 && d.value < p)) {
      return {
        ok: false,
        error: "Monto fijo inválido (debe ser > 0 y < precio).",
      };
    }
  }
  if (d.startAt && d.endAt && d.endAt <= d.startAt) {
    return { ok: false, error: "La fecha fin debe ser posterior al inicio." };
  }
  return { ok: true, value: d };
}

/** ===================== CREATE ===================== */
exports.createProduct = async (req, res) => {
  try {
    const { sku, name, description, price } = req.body;
    const categoryId = normalizeCategory(req.body.categories);
    const validVariants = parseVariants(req.body.variants);

    if (!name || typeof price === "undefined") {
      return res
        .status(400)
        .json({ error: "Faltan campos obligatorios (name, price)." });
    }
    if (!categoryId) {
      return res.status(400).json({ error: "Categoría inválida o ausente." });
    }
    if (!validVariants.length) {
      return res
        .status(400)
        .json({ error: "Debes incluir al menos una variante válida" });
    }
    if (isDuplicateVariants(validVariants)) {
      return res
        .status(400)
        .json({ error: "Variantes repetidas (talla+color)." });
    }

    const imagePaths = (req.files || []).map(
      (file) => `/uploads/products/${file.filename}`
    );

    const newProduct = new Product({
      // si no viene, el pre-hook genera
      sku: typeof sku === "string" ? sku.trim() : undefined,
      name,
      description,
      price: Number(price),
      categories: categoryId,
      images: imagePaths,
      variants: validVariants,
    });

    // ← Nuevo: aceptar descuento en creación si se envía
    const discountFromReq = parseDiscountFromBody(req.body);
    if (discountFromReq && discountFromReq._error) {
      return res.status(400).json({ error: discountFromReq._error });
    }
    if (discountFromReq) {
      const { ok, error, value } = validateDiscountPayload(
        Number(price),
        discountFromReq
      );
      if (!ok) return res.status(400).json({ error });
      newProduct.discount = value;
    }

    try {
      await newProduct.save();
    } catch (e) {
      // Error de índice único (SKU duplicado)
      if (e?.code === 11000 && e?.keyPattern?.sku) {
        return res.status(409).json({ error: "SKU ya existe" });
      }
      throw e;
    }

    // Ledger — creación de variantes con snapshot
    const ledgerInserts = [];
    for (const v of newProduct.variants) {
      const { sizeLabel, colorName } = await getVariantSnapshots(
        v.size,
        v.color
      );
      ledgerInserts.push({
        productId: newProduct._id,
        size: v.size,
        color: v.color,
        sizeLabelSnapshot: sizeLabel,
        colorNameSnapshot: colorName,
        variantKey: keyOf(v.size, v.color),
        eventType: "CREATE_VARIANT",
        status: "ACTIVE",
        prevStock: null,
        newStock: Number(v.stock),
        priceSnapshot: Number(newProduct.price),
        skuSnapshot: String(newProduct.sku || ""),
        note: "Creación con stock inicial",
        user: req.user?.id || null,
      });
    }
    if (ledgerInserts.length) {
      await ProductVariantLedger.insertMany(ledgerInserts);
    }

    // Historial general del producto (tu modelo existente)
    await ProductEntryHistory.create({
      productId: newProduct._id,
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      categories: newProduct.categories,
      images: newProduct.images,
      variants: newProduct.variants.map((v) => ({
        size: v.size,
        color: v.color,
        initialStock: Number(v.stock),
      })),
      kind: "CREATE",
      note: "",
    });

    return res.status(201).json(newProduct);
  } catch (err) {
    console.error("Error al crear producto:", err);
    return res.status(500).json({ error: "Error al crear producto" });
  }
};

/** ===================== READ (LIST/GET) ===================== */
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("categories", "name")
      .populate("variants.size", "label")
      .populate("variants.color", "name");
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ message: "Error al obtener productos" });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("categories", "name")
      .populate("variants.size", "label")
      .populate("variants.color", "name");
    if (!product)
      return res.status(404).json({ error: "Producto no encontrado" });
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ error: "Error al buscar producto" });
  }
};

/** ===================== UPDATE ===================== */
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user?.id;

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ error: "Producto no encontrado" });

    const {
      sku,
      name,
      description,
      price,
      categories,
      existingImages = [],
      variants: rawVariants,
    } = req.body;

    // --- Imágenes: conservar existentes + agregar nuevas ---
    const existingImagesArray = Array.isArray(existingImages)
      ? existingImages
      : [existingImages].filter(Boolean);

    // Borrar físicas (best-effort) las que se quitan
    const imagesToDelete = product.images.filter(
      (img) => !existingImagesArray.includes(img)
    );
    for (const imgPath of imagesToDelete) {
      try {
        const safePath = path.join(process.cwd(), imgPath.replace(/^\//, ""));
        const safeBase = path.join(process.cwd(), "uploads", "products");
        if (safePath.startsWith(safeBase) && fs.existsSync(safePath)) {
          fs.unlinkSync(safePath);
        }
      } catch {}
    }

    const newImages = (req.files || []).map(
      (file) => `/uploads/products/${file.filename}`
    );
    const finalImages = [...existingImagesArray, ...newImages];

    // --- Snapshot previo para detectar eventos ---
    const prevVariantsSet = new Set(
      (product.variants || []).map((v) => keyOf(v.size, v.color))
    );
    const prevByKey = new Map(
      (product.variants || []).map((v) => [
        keyOf(v.size, v.color),
        { ...(v.toObject?.() || v) },
      ])
    );

    // --- Variantes (solo si se envían) ---
    let addedVariants = [];
    if (typeof rawVariants !== "undefined") {
      const validVariants = parseVariants(rawVariants);

      if (isDuplicateVariants(validVariants)) {
        return res
          .status(400)
          .json({ error: "Variantes repetidas (talla+color)." });
      }

      // Añadidas y editadas
      const nowPrice =
        typeof product.price === "number"
          ? product.price
          : Number(product.price) || 0;

      const nextKeys = new Set(
        validVariants.map((v) => keyOf(v.size, v.color))
      );

      // Añadidas
      for (const v of validVariants) {
        const k = keyOf(v.size, v.color);
        if (!prevVariantsSet.has(k)) {
          const { sizeLabel, colorName } = await getVariantSnapshots(
            v.size,
            v.color
          );
          await ProductVariantLedger.create({
            productId,
            size: v.size,
            color: v.color,
            sizeLabelSnapshot: sizeLabel,
            colorNameSnapshot: colorName,
            variantKey: k,
            eventType: "CREATE_VARIANT",
            status: "ACTIVE",
            prevStock: null,
            newStock: Number(v.stock),
            priceSnapshot: nowPrice,
            note: "Variante agregada en update",
            user: userId || null,
          });
          addedVariants.push(v);
        }
      }

      // Editadas (cambios de stock)
      for (const v of validVariants) {
        const k = keyOf(v.size, v.color);
        const prev = prevByKey.get(k);
        if (prev && Number(prev.stock) !== Number(v.stock)) {
          const { sizeLabel, colorName } = await getVariantSnapshots(
            v.size,
            v.color
          );
          await ProductVariantLedger.create({
            productId,
            size: v.size,
            color: v.color,
            sizeLabelSnapshot: sizeLabel,
            colorNameSnapshot: colorName,
            variantKey: k,
            eventType: "EDIT_STOCK",
            status: "ACTIVE",
            prevStock: Number(prev.stock),
            newStock: Number(v.stock),
            priceSnapshot: nowPrice,
            note: "Edición de stock",
            user: userId || null,
          });
        }
      }

      // Eliminadas (marcar como DELETED)
      for (const [k, prev] of prevByKey.entries()) {
        if (!nextKeys.has(k)) {
          const { sizeLabel, colorName } = await getVariantSnapshots(
            prev.size,
            prev.color
          );
          await ProductVariantLedger.create({
            productId,
            size: prev.size,
            color: prev.color,
            sizeLabelSnapshot: sizeLabel,
            colorNameSnapshot: colorName,
            variantKey: k,
            eventType: "DELETE_VARIANT",
            status: "DELETED",
            prevStock: Number(prev.stock),
            newStock: Number(prev.stock), // último stock conocido
            priceSnapshot: nowPrice,
            note: "Eliminación lógica de variante",
            user: userId || null,
          });
        }
      }

      // confirman reemplazo de variantes en el producto
      product.variants = validVariants;
    }

    if (typeof sku !== "undefined" && sku.trim() !== product.sku) {
      changes.sku = { old: product.sku, new: sku.trim() };
      product.sku = sku.trim();
    }

    // --- Cambios auditables ---
    const changes = {};

    if (typeof name !== "undefined" && name !== product.name) {
      changes.name = { old: product.name, new: name };
      product.name = name;
    }
    if (
      typeof description !== "undefined" &&
      description !== product.description
    ) {
      changes.description = { old: product.description, new: description };
      product.description = description;
    }
    if (
      typeof price !== "undefined" &&
      Number(price) !== Number(product.price)
    ) {
      changes.price = { old: product.price, new: Number(price) };
      product.price = Number(price);
    }

    if (typeof categories !== "undefined") {
      const newCat = normalizeCategory(categories);
      if (newCat && String(newCat) !== String(product.categories)) {
        changes.categories = { old: product.categories, new: newCat };
        product.categories = newCat;
      }
    }

    // --- Descuento (si se envía) ---
    let discountFromReq = parseDiscountFromBody(req.body);
    if (discountFromReq && discountFromReq._error) {
      return res.status(400).json({ error: discountFromReq._error });
    }
    if (discountFromReq) {
      // Determinar el precio que usaremos para validar el descuento
      const priceToValidate =
        typeof price !== "undefined" ? Number(price) : Number(product.price);

      const { ok, error, value } = validateDiscountPayload(
        priceToValidate,
        discountFromReq
      );
      if (!ok) return res.status(400).json({ error });

      const prev = product.discount || {};
      const changedDiscount =
        !!value.enabled !== !!prev.enabled ||
        String(value.type) !== String(prev.type) ||
        Number(value.value || 0) !== Number(prev.value || 0) ||
        (prev.startAt ? prev.startAt.getTime() : null) !==
          (value.startAt ? value.startAt.getTime() : null) ||
        (prev.endAt ? prev.endAt.getTime() : null) !==
          (value.endAt ? value.endAt.getTime() : null);

      if (changedDiscount) {
        product.discount = value;
        product.markModified("discount");
      }
    }

    // Aplicar imágenes al final
    product.images = finalImages;

    // --- Guardar producto ---
    try {
      await product.save();
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.sku) {
        return res.status(409).json({ error: "SKU ya existe" });
      }
      throw e;
    }
    // --- Auditoría (si hubiera cambios) ---
    if (userId && Object.keys(changes).length > 0) {
      await ProductAudit.create({
        product: product._id,
        user: userId,
        action: "updated",
        changes,
      });
    }

    // === Entradas de HISTORIAL por eventos (tu modelo existente) ===
    let createdHistoryVariantId = null;
    let createdHistoryPriceId = null;

    // Variantes añadidas
    if (Array.isArray(addedVariants) && addedVariants.length > 0) {
      const doc = await ProductEntryHistory.create({
        productId: product._id,
        name: product.name,
        description: product.description,
        price: product.price, // precio vigente
        categories: product.categories,
        images: product.images,
        variants: addedVariants.map((v) => ({
          size: v.size,
          color: v.color,
          initialStock: Number(v.stock),
        })),
        kind: "UPDATE_VARIANTS",
        note: "Se añadieron variantes",
      });
      createdHistoryVariantId = doc._id;

      const io = req.app.get("io");
      if (io) {
        const populated = await doc.populate([
          { path: "categories", select: "name" },
          { path: "variants.size", select: "label" },
          { path: "variants.color", select: "name" },
        ]);
        io.emit("productHistory:new", populated);
      }
    }

    // Cambio de precio
    if (
      typeof changes.price !== "undefined" &&
      changes.price.new !== changes.price.old
    ) {
      const doc = await ProductEntryHistory.create({
        productId: product._id,
        name: product.name,
        description: product.description,
        price: product.price, // nuevo precio
        categories: product.categories,
        images: product.images,
        variants: [], // no aplica variantes
        kind: "UPDATE_PRICE",
        note: `Precio anterior: ${changes.price.old}, nuevo: ${changes.price.new}`,
      });
      createdHistoryPriceId = doc._id;

      const io = req.app.get("io");
      if (io) {
        const populated = await doc.populate([
          { path: "categories", select: "name" },
        ]);
        io.emit("productHistory:new", populated);
      }
    }

    return res.json({
      product,
      historyEvents: {
        variants: createdHistoryVariantId,
        price: createdHistoryPriceId,
      },
    });
  } catch (err) {
    console.error("Error al actualizar producto:", err);
    return res.status(500).json({ error: "Error al actualizar producto" });
  }
};

/** ===================== DELETE ===================== */
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Producto no encontrado" });
    return res.json({ message: "Producto eliminado correctamente" });
  } catch (err) {
    return res.status(500).json({ error: "Error al eliminar producto" });
  }
};

/** ===================== HISTORY (auditoría general ya existente) ===================== */
exports.getProductHistory = async (req, res) => {
  try {
    const audits = await ProductAudit.find({ product: req.params.id })
      .populate("user", "name email")
      .sort({ timestamp: -1 });
    return res.json(audits);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error al obtener historial del producto" });
  }
};

exports.getProductEntryHistory = async (req, res) => {
  try {
    const history = await ProductEntryHistory.find()
      .populate("categories", "name")
      .populate("variants.size", "label")
      .populate("variants.color", "name")
      .sort({ createdAt: -1 });
    return res.json(history);
  } catch (err) {
    console.error("Error al obtener historial:", err);
    return res
      .status(500)
      .json({ error: "Error al obtener historial de productos" });
  }
};

/** ===================== LEDGER por producto ===================== */
exports.getVariantLedgerByProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { variantKey, status, from, to, limit = 200 } = req.query;

    const q = { productId: id };
    if (variantKey) q.variantKey = String(variantKey);
    if (status && ["ACTIVE", "DELETED"].includes(status)) q.status = status;

    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }

    const rows = await ProductVariantLedger.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 200, 1000))
      .lean();

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Error al obtener ledger de variantes" });
  }
};

/** ===================== Ventas por producto (adjust si tu modelo difiere) ===================== */
exports.getProductSalesHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, limit = 500 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const productObjectId = new mongoose.Types.ObjectId(id);

    const match = { "items.product": productObjectId };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $match: { "items.product": productObjectId } },

      // Fallback de precio si la orden antigua no tiene items.unitPrice
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
          unitPriceRaw: { $ifNull: ["$items.unitPrice", "$productDoc.price"] },
          quantityRaw: { $ifNull: ["$items.quantity", 0] },
        },
      },
      {
        $addFields: {
          unitPrice: {
            $cond: [
              {
                $and: [
                  { $ne: ["$unitPriceRaw", null] },
                  { $ne: ["$unitPriceRaw", ""] },
                ],
              },
              { $toDouble: "$unitPriceRaw" },
              0,
            ],
          },
          quantity: { $toInt: "$quantityRaw" },
        },
      },
      {
        $addFields: { total: { $multiply: ["$unitPrice", "$quantity"] } },
      },
      {
        $project: {
          _id: 0,
          orderId: "$_id",
          date: "$createdAt",
          sizeLabel: { $ifNull: ["$sizeDoc.label", "Desconocido"] },
          colorName: { $ifNull: ["$colorDoc.name", "Desconocido"] },
          unitPrice: 1,
          quantity: 1,
          total: 1,
        },
      },
      { $sort: { date: -1 } },
      { $limit: Math.min(Number(limit) || 500, 2000) },
    ]);

    return res.json(rows || []);
  } catch (e) {
    console.error("Error en getProductSalesHistory:", e);
    return res
      .status(500)
      .json({ error: "Error al obtener historial de ventas" });
  }
};

/* Ocultar detalle al publico si esta agotado el producto */
exports.getPublicProductById = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id)
      .populate("categories", "name slug")
      .populate("variants.size", "label")
      .populate("variants.color", "name");

    if (!p) return res.status(404).json({ error: "Producto no encontrado" });

    const isAdmin = req.user?.role === "admin";
    const totalStock = (p.variants || []).reduce(
      (s, v) => s + (Number(v.stock) || 0),
      0
    );

    if (!isAdmin && totalStock <= 0) {
      // Oculto al público si está agotado
      return res.status(404).json({ error: "Producto no disponible" });
    }

    // opcional: adjuntar effectivePrice calculado server-side
    const eff =
      typeof p.getEffectivePrice === "function"
        ? p.getEffectivePrice()
        : p.price;
    return res.json({ ...p.toObject(), effectivePrice: eff });
  } catch (e) {
    console.error("getPublicProductById error", e);
    res.status(500).json({ error: "Error al obtener producto" });
  }
};

/** ===================== PATCH STOCK VARIANTE ===================== */
exports.updateVariantStock = async (req, res) => {
  try {
    const { id, sizeId, colorId } = req.params;
    const { stock } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(sizeId) ||
      !mongoose.Types.ObjectId.isValid(colorId)
    ) {
      return res.status(400).json({ error: "IDs inválidos" });
    }
    const newStock = Number(stock);
    if (!Number.isFinite(newStock) || newStock < 0) {
      return res.status(400).json({ error: "Stock inválido (>= 0)" });
    }

    // Traer producto + variante actual
    const p = await Product.findOne(
      { _id: id, "variants.size": sizeId, "variants.color": colorId },
      { price: 1, sku: 1, "variants.$": 1 }
    ).lean();
    if (!p || !p.variants?.[0]) {
      return res.status(404).json({ error: "Variante no encontrada" });
    }
    const prev = Number(p.variants[0].stock) || 0;

    // Actualizar solo stock con operador posicional $
    const upd = await Product.updateOne(
      { _id: id, "variants.size": sizeId, "variants.color": colorId },
      { $set: { "variants.$.stock": newStock } }
    );
    if (!upd.modifiedCount) {
      return res.status(400).json({ error: "No se pudo actualizar stock" });
    }

    // Registrar en ledger
    const { sizeLabel, colorName } = await getVariantSnapshots(sizeId, colorId);
    await ProductVariantLedger.create({
      productId: id,
      size: sizeId,
      color: colorId,
      sizeLabelSnapshot: sizeLabel,
      colorNameSnapshot: colorName,
      variantKey: keyOf(sizeId, colorId),
      eventType: "EDIT_STOCK",
      status: "ACTIVE",
      prevStock: prev,
      newStock: newStock,
      priceSnapshot: Number(p.price) || 0,
      note: "Edición de stock vía endpoint dedicado",
      user: req.user?.id || null,
    });

    return res.json({ ok: true, prevStock: prev, newStock });
  } catch (e) {
    console.error("updateVariantStock error:", e);
    return res.status(500).json({ error: "Error al actualizar stock" });
  }
};
