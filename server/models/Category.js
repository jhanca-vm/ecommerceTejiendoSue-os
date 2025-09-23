const mongoose = require("mongoose");

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
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, default: "" },
    heroImage: { type: String, default: "" },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    sortPriority: { type: Number, default: 0 },

    menuSection: {
      type: String,
      enum: ["artesanias", "cafe", "panela", "otros"],
      default: "artesanias",
      index: true,
    },
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

module.exports =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
module.exports.slugify = slugify;
