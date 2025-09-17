const AdminAlert = require("../models/AdminAlert");
const Product = require("../models/Product");

async function emitOutOfStockAlertIfNeeded(productId) {
  const prod = await Product.findById(productId, { name: 1, variants: 1 });
  if (!prod) return;

  const total = (prod.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
  if (total > 0) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  const exists = await AdminAlert.findOne({
    product: productId,
    type: "OUT_OF_STOCK",
    createdAt: { $gte: today }
  });

  if (exists) return; // ya alertado hoy

  await AdminAlert.create({
    type: "OUT_OF_STOCK",
    product: productId,
    message: `El producto "${prod.name}" se quedó sin stock.`,
  });
}

module.exports = { emitOutOfStockAlertIfNeeded };
