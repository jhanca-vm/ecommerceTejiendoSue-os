// server/models/Product.js
const mongoose = require("mongoose");

//SKU: 6–64 chars, alfanumérico + guiones/guion_bajo, sin espacios
const SKU_REGEX = /^[A-Z0-9][A-Z0-9-_]{5,63}$/i;

const variantSchema = new mongoose.Schema(
  {
    size: { type: mongoose.Schema.Types.ObjectId, ref: "Size", required: true },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
    },
    stock: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const discountSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ["PERCENT", "FIXED"], default: "PERCENT" },
    value: { type: Number, default: 0 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
      match: [SKU_REGEX, "SKU inválido"],
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    price: { type: Number, required: true, min: 0 },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) =>
          arr.every(
            (p) => typeof p === "string" && p.startsWith("/uploads/products/")
          ),
        message: "Ruta de imagen inválida.",
      },
    },
    categories: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    variants: { type: [variantSchema], default: [] },
    discount: { type: discountSchema, default: {} },

    // NUEVOS
    salesCount: { type: Number, default: 0, index: true },
    trendingScore: { type: Number, default: 0, index: true }, // opcional

    // Datos de reviews
    ratingAvg: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    ratingDist: {
      type: Object,
      default: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
    },
  },
  { timestamps: true }
);

// Autogenera SKU si no viene (legible + sufijo corto)
productSchema.pre("validate", async function (next) {
  try {
    if (this.sku) return next();
    const base =
      String(this.name || "PROD")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase()
        .slice(0, 20) || "PROD";
    const uniq = Date.now().toString(36).toUpperCase().slice(-4);
    this.sku = `${base}-${uniq}`;
    next();
  } catch (e) {
    next(e);
  }
});

productSchema.methods.getEffectivePrice = function (now = new Date()) {
  const price = Number(this.price) || 0;
  const d = this.discount || {};
  if (!d.enabled) return price;
  if (d.startAt && now < d.startAt) return price;
  if (d.endAt && now > d.endAt) return price;
  let eff = price;
  if (d.type === "PERCENT")
    eff = price - (price * (Number(d.value) || 0)) / 100;
  else eff = price - (Number(d.value) || 0);
  if (eff < 0) eff = 0;
  return Number(eff.toFixed(2));
};

// ÍNDICES
// Unicidad case-insensitive con collation (usar misma collation en queries si buscas por sku)
try {
  productSchema.index(
    { sku: 1 },
    { unique: true, collation: { locale: "es", strength: 2 } }
  );
} catch (_) {}

productSchema.index({ "discount.enabled": 1, "discount.endAt": 1 });
productSchema.index({ categories: 1, createdAt: -1 });
productSchema.index({ salesCount: -1, categories: 1 });
productSchema.index({ "variants.size": 1 });
productSchema.index({ "variants.color": 1 });
// Opcional: búsqueda simple por texto
// productSchema.index({ name: "text", description: "text" });

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
module.exports = Product;
