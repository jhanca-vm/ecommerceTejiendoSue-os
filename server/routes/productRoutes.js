const express = require("express");
const { body, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validation");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductHistory,
  getProductEntryHistory,
  getVariantLedgerByProduct,
  getProductSalesHistory,
  getPublicProductById,
} = require("../controllers/productController");

const {
  searchProducts,
  getProductSections,
} = require("../controllers/productSearchController");

const Product = require("../models/Product");
const { verifyToken, isAdmin } = require("../middleware/auth");
const uploadMiddleware = require("../middleware/uploadMiddleware");

const router = express.Router();

/* ======================= Rate limit ======================= */
const productLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Demasiadas solicitudes, intenta más tarde.",
});

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

/* ======================= Helpers públicos ======================= */
function computeEffectivePrice(p, now = new Date()) {
  const price = Number(p?.price) || 0;
  const d = p?.discount || {};
  if (!d.enabled) return price;
  const start = d.startAt ? new Date(d.startAt) : null;
  const end = d.endAt ? new Date(d.endAt) : null;
  if (start && now < start) return price;
  if (end && now > end) return price;

  let eff = price;
  if (d.type === "PERCENT")
    eff = price - (price * (Number(d.value) || 0)) / 100;
  else eff = price - (Number(d.value) || 0);
  return Number(Math.max(0, eff).toFixed(2));
}

function shapePublicProduct(p) {
  return {
    _id: p._id,
    name: p.name,
    price: p.price,
    effectivePrice: computeEffectivePrice(p),
    images: Array.isArray(p.images) ? p.images : [],
    variants: Array.isArray(p.variants)
      ? p.variants.map((v) => ({
          size: v?.size
            ? { _id: v.size._id || v.size, label: v.size.label }
            : null,
          color: v?.color
            ? { _id: v.color._id || v.color, name: v.color.name }
            : null,
          stock: typeof v?.stock === "number" ? v.stock : 0,
        }))
      : [],
  };
}

/* ====================== Validadores CRUD ====================== */
// Validadores estrictos para CREATE
const createValidators = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Nombre requerido"),
  body("price").isFloat({ min: 0 }).withMessage("Precio inválido"),
  body("categories")
    .custom((v) => isObjectId(v))
    .withMessage("Categoría inválida"),
  body("variants").custom((raw) => {
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr) || arr.length < 1) throw new Error();
      for (const v of arr) {
        if (!isObjectId(v.size) || !isObjectId(v.color))
          throw new Error("Variante inválida (size/color).");
        if (!(Number(v.stock) >= 0))
          throw new Error("Variante inválida (stock).");
      }
      return true;
    } catch {
      throw new Error("Formato de variantes inválido (requiere al menos una).");
    }
  }),
  // descuento: si llega, validarlo
  body("discount[enabled]").optional().isIn(["true", "false"]),
  body("discount[type]").optional().isIn(["PERCENT", "FIXED"]),
  body("discount[value]").optional().isFloat({ min: 0 }),
  body("discount[startAt]").optional().isISO8601(),
  body("discount[endAt]").optional().isISO8601(),
];

// Validadores relajados para UPDATE (como ya tenías)
const updateValidators = [
  body("name").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("description").optional().isString().trim().isLength({ max: 5000 }),
  body("price").optional().isFloat({ min: 0 }),
  body("categories")
    .optional()
    .custom((v) => {
      if (!isObjectId(v)) throw new Error("Categoría inválida.");
      return true;
    }),
  body("variants")
    .optional()
    .custom((raw) => {
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) throw new Error();
        for (const v of arr) {
          if (!isObjectId(v.size) || !isObjectId(v.color))
            throw new Error("Variante inválida (size/color).");
          if (!(Number(v.stock) >= 0))
            throw new Error("Variante inválida (stock).");
        }
        return true;
      } catch {
        throw new Error("Formato de variantes inválido.");
      }
    }),
  body("discount[enabled]").optional().isIn(["true", "false"]),
  body("discount[type]").optional().isIn(["PERCENT", "FIXED"]),
  body("discount[value]").optional().isFloat({ min: 0 }),
  body("discount[startAt]").optional().isISO8601(),
  body("discount[endAt]").optional().isISO8601(),
];

const idParamValidator = [param("id").isMongoId().withMessage("ID inválido")];

/* ================================================================
   RUTAS PÚBLICAS — ¡IMPORTANTE! Van ANTES de `/:id`
   para que `/:id` no capture `/bulk`, `/public/:id`, `/search`, `/sections`.
   ================================================================ */

/** Handler robusto para /bulk (GET y POST) — FIX: castear explícitamente a ObjectId[] */
async function bulkHandler(req, res, next) {
  try {
    let raw = [];
    if (req.method === "GET") {
      const q = req.query.ids;
      if (Array.isArray(q)) raw = q;
      else if (typeof q === "string") raw = q.split(",");
    } else if (req.method === "POST") {
      if (Array.isArray(req.body?.ids)) raw = req.body.ids;
      else if (typeof req.body?.ids === "string") raw = req.body.ids.split(",");
    }

    // normaliza
    const ids = Array.from(
      new Set((raw || []).map((s) => String(s || "").trim()).filter(Boolean))
    );

    // valida 24-hex
    const validHex = ids.filter(
      (s) => /^[0-9a-fA-F]{24}$/.test(s) && mongoose.Types.ObjectId.isValid(s)
    );
    if (validHex.length === 0) {
      return res.status(400).json({
        error: "No valid ids",
        received: ids,
        reqId: req.id,
      });
    }

    // convierte a ObjectId[]
    const objIds = validHex.map((s) => new mongoose.Types.ObjectId(s));

    // ⚠️ Clave: usar aggregate para evitar caster de { $in: ... } en path _id
    let prods = await Product.aggregate([{ $match: { _id: { $in: objIds } } }]);

    // populate sobre el resultado del aggregate
    prods = await Product.populate(prods, [
      { path: "variants.size", select: "label" },
      { path: "variants.color", select: "name" },
    ]);

    // mantener orden original
    const map = new Map(prods.map((p) => [String(p._id), p]));
    const ordered = validHex
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        effectivePrice: (() => {
          const price = Number(p?.price) || 0;
          const d = p?.discount || {};
          if (!d.enabled) return price;
          const now = new Date();
          const start = d.startAt ? new Date(d.startAt) : null;
          const end = d.endAt ? new Date(d.endAt) : null;
          if (start && now < start) return price;
          if (end && now > end) return price;
          let eff = price;
          if (d.type === "PERCENT")
            eff = price - (price * (Number(d.value) || 0)) / 100;
          else eff = price - (Number(d.value) || 0);
          return Number(Math.max(0, eff).toFixed(2));
        })(),
        images: Array.isArray(p.images) ? p.images : [],
        variants: Array.isArray(p.variants)
          ? p.variants.map((v) => ({
              size: v?.size
                ? { _id: v.size._id || v.size, label: v.size.label }
                : null,
              color: v?.color
                ? { _id: v.color._id || v.color, name: v.color.name }
                : null,
              stock: typeof v?.stock === "number" ? v.stock : 0,
            }))
          : [],
      }));

    return res.json(ordered);
  } catch (err) {
    // deja reqId para rastreo
    return res.status(400).json({
      error: "Invalid ObjectId in ids",
      details: err?.message || String(err),
      reqId: req.id,
    });
  }
}

/** /bulk — acepta ids coma-separado y repetidos */
router.get("/bulk", productLimiter, bulkHandler);
router.post("/bulk", productLimiter, bulkHandler);

/** GET /public/:id — versión ligera para un solo producto */
router.get("/public/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "");
    if (!isObjectId(id)) return res.status(400).json({ error: "invalid id" });

    const p = await Product.findById(id)
      .populate({ path: "variants.size", select: "label" })
      .populate({ path: "variants.color", select: "name" })
      .lean();

    if (!p) return res.status(404).json({ error: "not found" });
    return res.json(shapePublicProduct(p));
  } catch (err) {
    next(err);
  }
});

/** Búsqueda pública / secciones */
router.get("/search", productLimiter, searchProducts);
router.get("/sections", productLimiter, getProductSections);

/* ===================== CRUD y endpoints existentes ===================== */
router.get("/", getProducts);
router.get("/:id", idParamValidator, handleValidationErrors, getProductById);

router.post(
  "/",
  productLimiter,
  verifyToken,
  isAdmin,
  uploadMiddleware,
  createValidators,
  handleValidationErrors,
  createProduct
);

router.put(
  "/:id",
  productLimiter,
  verifyToken,
  isAdmin,
  idParamValidator,
  uploadMiddleware,
  updateValidators,
  handleValidationErrors,
  updateProduct
);

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  idParamValidator,
  handleValidationErrors,
  deleteProduct
);

/* ===================== Historial / métricas ===================== */
router.get("/history/all", verifyToken, isAdmin, getProductEntryHistory); // no confl. con :id
router.get(
  "/:id/history",
  verifyToken,
  isAdmin,
  idParamValidator,
  handleValidationErrors,
  getProductHistory
);
router.get(
  "/:id/ledger",
  productLimiter,
  verifyToken,
  isAdmin,
  idParamValidator,
  handleValidationErrors,
  getVariantLedgerByProduct
);
router.get(
  "/:id/sales-history",
  productLimiter,
  verifyToken,
  isAdmin,
  idParamValidator,
  handleValidationErrors,
  getProductSalesHistory
);

module.exports = router;
