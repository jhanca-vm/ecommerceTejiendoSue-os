const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["abierto", "en_espera", "cerrado"],
      default: "abierto",
      index: true,
    },
    readPointers: {
      user: { type: Date, default: null },
      admin: { type: Date, default: null },
    },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: "" },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, assignedTo: 1, status: 1 });
conversationSchema.index({ assignedTo: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ user: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
