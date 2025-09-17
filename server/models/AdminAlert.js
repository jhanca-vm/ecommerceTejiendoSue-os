const mongoose = require("mongoose");

const adminAlertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["OUT_OF_STOCK", "LOW_STOCK"], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    message: { type: String, required: true },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AdminAlert || mongoose.model("AdminAlert", adminAlertSchema);
