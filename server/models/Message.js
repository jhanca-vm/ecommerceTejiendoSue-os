const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["abierto", "cerrado", "en_espera"],
      default: "abierto",
    },
  },
  { timestamps: true }
);

// Índices útiles para listados y no leídos
messageSchema.index({ to: 1, isRead: 1, createdAt: -1 });
messageSchema.index({ from: 1, to: 1, createdAt: -1 });

// 7 días para el eliminado de los mensajes
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 });

module.exports = mongoose.model("Message", messageSchema);
