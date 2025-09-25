const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      index: true,
      default: null, // legacy seguirá siendo null; los nuevos mensajes lo establecen
    },

    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Compatibilidad: contenido en claro NO se devuelve por defecto
    content: { type: String, select: false },

    // Nuevo: payload cifrado (AES-256-GCM)
    contentEnc: {
      data: { type: String }, // base64
      iv: { type: String },   // base64 (12 bytes)
      tag: { type: String },  // base64 (16 bytes)
      alg: { type: String, default: "aes-256-gcm" },
    },

    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["abierto", "cerrado", "en_espera"],
      default: "abierto",
    },
  },
  { timestamps: true }
);

// TTL: borra mensajes 7 días después de su createdAt (ajústalo si conviene)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model("Message", messageSchema);
