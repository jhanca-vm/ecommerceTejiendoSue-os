const mongoose = require("mongoose");

// Util: slugify simple (sin dependencias)
function slugify(str = "") {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")     
    .replace(/[^a-zA-Z0-9\s-]/g, "")     
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    heroImage: { type: String, default: "" },          // opcional UX
    seoTitle: { type: String, default: "" },           // opcional SEO
    seoDescription: { type: String, default: "" },     // opcional SEO
    isActive: { type: Boolean, default: true },        // opcional
    sortPriority: { type: Number, default: 0 },        // opcional
  },
  { timestamps: true }
);

// Genera slug si no viene; si cambia name y no hay slug explícito, lo recalcula
categorySchema.pre("validate", async function (next) {
  if (!this.slug && this.name) this.slug = slugify(this.name);
  next();
});

// Índice único case-insensitive (requiere Mongo que soporte collation)
try {
  categorySchema.index(
    { name: 1 },
    { unique: true, collation: { locale: "es", strength: 2 } }
  );
} catch (_) {}

module.exports = mongoose.models.Category || mongoose.model("Category", categorySchema);
module.exports.slugify = slugify;
