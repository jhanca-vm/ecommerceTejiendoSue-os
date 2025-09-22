const mongoose = require("mongoose");

const adminAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "OUT_OF_STOCK",
        "LOW_STOCK",
        "OUT_OF_STOCK_VARIANT",
        "LOW_STOCK_VARIANT",
        // === NUEVO ===
        "ORDER_STALE_STATUS",
      ],
      required: true,
    },

    // Para alertas de inventario (ya existentes)
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    variant: {
      size: { type: mongoose.Schema.Types.ObjectId, ref: "Size" },
      color: { type: mongoose.Schema.Types.ObjectId, ref: "Color" },
    },

    // === NUEVO: para alertas por pedidos estancados ===
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    orderStatus: {
      type: String,
      enum: [
        "pendiente",
        "facturado",
        "enviado",
        "entregado",
        "cancelado",
        null,
      ],
      default: null,
      index: true,
    },

    message: { type: String, required: true },
    seen: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

adminAlertSchema.index({ seen: 1, createdAt: -1 });
adminAlertSchema.index({
  product: 1,
  "variant.size": 1,
  "variant.color": 1,
  createdAt: -1,
});
// para deduplicar razonablemente por pedido/estado
adminAlertSchema.index({ order: 1, orderStatus: 1, createdAt: -1 });

module.exports =
  mongoose.models.AdminAlert || mongoose.model("AdminAlert", adminAlertSchema);
