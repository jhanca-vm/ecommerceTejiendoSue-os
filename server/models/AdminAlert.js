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
      ],
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variant: {
      size: { type: mongoose.Schema.Types.ObjectId, ref: "Size" },
      color: { type: mongoose.Schema.Types.ObjectId, ref: "Color" },
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

module.exports =
  mongoose.models.AdminAlert || mongoose.model("AdminAlert", adminAlertSchema);
