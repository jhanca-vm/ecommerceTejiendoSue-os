const { Cart, clampQty } = require("../models/Cart");
const Product = require("../models/Product"); 
const Size = require("../models/Size");
const Color = require("../models/Color");

// Helpers de validación básica de ObjectId
const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);
function requireIds({ productId, sizeId, colorId }) {
  if (!isObjectId(productId)) throw createError(400, "productId inválido");
  if (sizeId != null && sizeId !== "" && !isObjectId(sizeId))
    throw createError(400, "sizeId inválido");
  if (colorId != null && colorId !== "" && !isObjectId(colorId))
    throw createError(400, "colorId inválido");
}

// Pequeño factory de errores HTTP
function createError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Busca el producto y valida variante (si aplica)
async function ensureProductVariantExists(productId, sizeId, colorId) {
  const product = await Product.findById(productId)
    .select("_id variants")
    .lean();
  if (!product) throw createError(404, "Producto no encontrado");

  const hasVariants =
    Array.isArray(product.variants) && product.variants.length > 0;

  if (!hasVariants) {
    // Producto sin variantes: ignoramos size/color si llegaron, pero no fallamos
    return { product, variant: null };
  }

  if (!sizeId || !colorId) {
    throw createError(400, "Este producto requiere sizeId y colorId");
  }

  // (Opcional) verifica existencia de Size/Color como documentos válidos
  // await Promise.all([Size.exists({ _id: sizeId }), Color.exists({ _id: colorId })])

  const v = product.variants.find(
    (it) =>
      String(it.size) === String(sizeId) && String(it.color) === String(colorId)
  );

  if (!v) throw createError(404, "Variante no encontrada para este producto");

  return { product, variant: v };
}

// Chequea/ajusta stock. Devuelve cantidad permitida (>=1) o lanza error si 0.
async function ensureStock({ product, variant, requestedQty }) {
  const qty = clampQty(requestedQty);

  // Si no hay variantes, asumimos que el stock se maneja en otro proceso o no aplica
  if (!variant) return qty;

  const stock = Number(variant.stock) || 0;
  if (stock <= 0)
    throw createError(409, "Sin stock para la variante seleccionada");

  const allowed = Math.min(qty, stock);
  if (allowed <= 0) throw createError(409, "Sin stock disponible");
  return allowed;
}

function serialize(cartDoc) {
  return {
    items: cartDoc.items.map((i) => ({
      productId: String(i.product),
      sizeId: i.size ? String(i.size) : null,
      colorId: i.color ? String(i.color) : null,
      quantity: i.quantity,
    })),
    version: cartDoc.version,
    updatedAt: cartDoc.updatedAt,
  };
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [], version: 1 });
  return cart;
}

// GET /api/cart
exports.getCart = async (req, res, next) => {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const cart = await getOrCreateCart(uid);
    res.set("ETag", `"${cart.version}"`);
    return res.json(serialize(cart));
  } catch (err) {
    next(err);
  }
};

// POST /api/cart/items
exports.addItem = async (req, res, next) => {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      productId,
      sizeId = null,
      colorId = null,
      quantity = 1,
    } = req.body || {};
    requireIds({ productId, sizeId, colorId });

    const { product, variant } = await ensureProductVariantExists(
      productId,
      sizeId,
      colorId
    );
    const allowedQty = await ensureStock({
      product,
      variant,
      requestedQty: quantity,
    });

    const cart = await getOrCreateCart(uid);
    cart.upsertItem({ productId, sizeId, colorId, quantity: allowedQty });
    cart.bumpVersion();
    await cart.save();

    res.set("ETag", `"${cart.version}"`);
    return res.json(serialize(cart));
  } catch (err) {
    next(
      err.status
        ? err
        : createError(500, err.message || "Error al agregar al carrito")
    );
  }
};

// PATCH /api/cart/items
exports.updateItem = async (req, res, next) => {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      productId,
      sizeId = null,
      colorId = null,
      quantity,
    } = req.body || {};
    requireIds({ productId, sizeId, colorId });
    const qty = clampQty(quantity);

    const { product, variant } = await ensureProductVariantExists(
      productId,
      sizeId,
      colorId
    );
    const allowedQty = await ensureStock({
      product,
      variant,
      requestedQty: qty,
    });

    const cart = await getOrCreateCart(uid);

    // Concurrencia optimista
    const ifMatch = req.headers["if-match"];
    if (ifMatch && ifMatch !== `"${cart.version}"`) {
      res.set("ETag", `"${cart.version}"`);
      return res.status(412).json({ error: "Version conflict" });
    }

    const ok = cart.updateQty({
      productId,
      sizeId,
      colorId,
      quantity: allowedQty,
    });
    if (!ok) return res.status(404).json({ error: "Item not found" });

    cart.bumpVersion();
    await cart.save();

    res.set("ETag", `"${cart.version}"`);
    return res.json(serialize(cart));
  } catch (err) {
    next(
      err.status
        ? err
        : createError(500, err.message || "Error al actualizar el carrito")
    );
  }
};

// DELETE /api/cart/items
exports.removeItem = async (req, res, next) => {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { productId, sizeId = null, colorId = null } = req.body || {};
    requireIds({ productId, sizeId, colorId });

    await ensureProductVariantExists(productId, sizeId, colorId); // valida que la variante existe

    const cart = await getOrCreateCart(uid);

    const ifMatch = req.headers["if-match"];
    if (ifMatch && ifMatch !== `"${cart.version}"`) {
      res.set("ETag", `"${cart.version}"`);
      return res.status(412).json({ error: "Version conflict" });
    }

    const ok = cart.removeItem({ productId, sizeId, colorId });
    if (!ok) return res.status(404).json({ error: "Item not found" });

    cart.bumpVersion();
    await cart.save();

    res.set("ETag", `"${cart.version}"`);
    return res.json(serialize(cart));
  } catch (err) {
    next(
      err.status
        ? err
        : createError(500, err.message || "Error al eliminar del carrito")
    );
  }
};

// POST /api/cart/merge  (opcional: al loguear, fusiona carrito local)
exports.mergeCart = async (req, res, next) => {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
    const cart = await getOrCreateCart(uid);

    for (const raw of incoming) {
      const productId = raw?.productId;
      const sizeId = raw?.sizeId || null;
      const colorId = raw?.colorId || null;
      const quantity = clampQty(raw?.quantity || 1);

      requireIds({ productId, sizeId, colorId });
      const { product, variant } = await ensureProductVariantExists(
        productId,
        sizeId,
        colorId
      );
      const allowedQty = await ensureStock({
        product,
        variant,
        requestedQty: quantity,
      });

      cart.upsertItem({ productId, sizeId, colorId, quantity: allowedQty });
    }

    cart.bumpVersion();
    await cart.save();

    res.set("ETag", `"${cart.version}"`);
    return res.json(serialize(cart));
  } catch (err) {
    next(
      err.status
        ? err
        : createError(500, err.message || "Error al fusionar carrito")
    );
  }
};
