const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
});

// Índice único case-insensitive (requiere Mongo que soporte collation)
try {
  colorSchema.index(
    { name: 1 },
    { unique: true, collation: { locale: "es", strength: 2 } }
  );
} catch (_) {}

const Color = mongoose.models.Color || mongoose.model("Color", colorSchema);

module.exports = Color;