const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // Participantes
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, 

    // Estado de la conversación
    status: {
      type: String,
      enum: ["abierto", "en_espera", "cerrado"],
      default: "abierto",
      index: true,
    },

    // Lectura (punteros por rol)
    readPointers: {
      user: { type: Date, default: null },  
      admin: { type: Date, default: null }, 
    },

    // Metadatos de lista
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: "" },
  },
  { timestamps: true }
);

// Opcional: 1 conversación "activa" por usuario (no cerrado) con ese admin
// (no lo hacemos único estricto para no romper flujos legacy)
conversationSchema.index({ user: 1, assignedTo: 1, status: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
