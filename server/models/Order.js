//models/Order.js
const mongoose = require("mongoose");

const shippingInfoSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: mongoose.Schema.Types.ObjectId, ref: "Size" },
    color: { type: mongoose.Schema.Types.ObjectId, ref: "Color" },
    unitPrice: { type: Number, required: true, min: 0 },
    stockBeforePurchase: { type: Number, default: null },
    stockAtPurchase: { type: Number, required: true },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    from: {
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
    },
    to: {
      type: String,
      enum: ["pendiente", "facturado", "enviado", "entregado", "cancelado"],
      required: true,
    },
    at: { type: Date, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    idempotencyKey: { type: String, default: null, index: true },

    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pendiente", "facturado", "enviado", "entregado", "cancelado"],
      default: "pendiente",
      index: true,
    },

    // === NUEVO: fechas por estado e histórico ===
    statusTimestamps: {
      pendiente: { type: Date, default: null },
      facturado: { type: Date, default: null },
      enviado: { type: Date, default: null },
      entregado: { type: Date, default: null },
      cancelado: { type: Date, default: null },
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    currentStatusAt: { type: Date, default: null },

    trackingNumber: { type: String, default: "" },
    shippingCompany: { type: String, default: "" },
    adminComment: { type: String, default: "" },
    shippingInfo: { type: shippingInfoSchema, default: undefined },

    // Evita sumar ventas dos veces si el estado cambia varias veces
    wasCountedForBestsellers: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ "items.product": 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);
// Para consultas de SLA
orderSchema.index({ status: 1, currentStatusAt: 1 });

module.exports = mongoose.model("Order", orderSchema);
