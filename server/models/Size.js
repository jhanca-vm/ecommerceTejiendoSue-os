const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
});

// Índice único case-insensitive (requiere Mongo que soporte collation)
try {
  sizeSchema.index(
    { label: 1 },
    { unique: true, collation: { locale: "es", strength: 2 } }
  );
} catch (_) {}

const Size = mongoose.models.Size || mongoose.model("Size", sizeSchema);

module.exports = Size;