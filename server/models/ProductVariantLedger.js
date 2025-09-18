const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },

  // Referencias "vivas" (si aún existen)
  size:  { type: mongoose.Schema.Types.ObjectId, ref: "Size",  required: false },
  color: { type: mongoose.Schema.Types.ObjectId, ref: "Color", required: false },

  // Copia inmutable para mostrar aunque se eliminen catálogos
  sizeLabelSnapshot:  { type: String, required: true },
  colorNameSnapshot:  { type: String, required: true },
  skuSnapshot:        { type: String, default: "" },

  // Identificador lógico de la variante (size+color)
  variantKey: { type: String, required: true, index: true }, // `${sizeId}::${colorId}` o `${sizeLabel}::${colorName}` si no hay refs

  // Estado y tipo de evento
  eventType: { 
    type: String, 
    enum: ["CREATE_VARIANT","ADD_STOCK","EDIT_STOCK","DELETE_VARIANT","UPDATE_PRICE_SNAPSHOT"], 
    required: true 
  },
  status: { type: String, enum: ["ACTIVE","DELETED"], default: "ACTIVE", index: true },

  // Stock antes/después
  prevStock: { type: Number, min: 0, default: null },
  newStock:  { type: Number, min: 0, default: null },

  // Precio vigente en el momento del evento (opcional, útil para auditoría)
  priceSnapshot: { type: Number, min: 0, default: null },

  // Metadatos
  note: { type: String, maxlength: 500 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

entrySchema.index({ productId: 1, createdAt: -1 });
entrySchema.index({ productId: 1, variantKey: 1, createdAt: -1 });

module.exports = mongoose.model("ProductVariantLedger", entrySchema);
