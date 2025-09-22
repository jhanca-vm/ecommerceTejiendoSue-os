const AdminAlert = require("../models/AdminAlert");
const Product = require("../models/Product");
const Order = require("../models/Order");

const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 3);
const RENOTIFY_HOURS = Number(process.env.ORDER_STALE_RENOTIFY_HOURS || 24);

// Helpers tiempo
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const since24h = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

/** Debug mínimo para validar que createdAt es Date en el modelo */
function debugSchemaOnce() {
  if (debugSchemaOnce._done) return;
  try {
    const inst = AdminAlert.schema?.path("createdAt")?.instance;
    console.log("[AdminAlert] createdAt instance:", inst);
  } catch {}
  debugSchemaOnce._done = true;
}

//helper para el estado de los pedidos estancados
function hoursToMs(h) {
  return Number(h) * 60 * 60 * 1000;
}

async function lastAlertWithin(orderId, status, withinMs) {
  const last = await AdminAlert.findOne({
    type: "ORDER_STALE_STATUS",
    order: orderId,
    orderStatus: status,
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!last) return false;
  try {
    return Date.now() - new Date(last.createdAt).getTime() <= withinMs;
  } catch {
    return false;
  }
}

/**
 * Devuelve true si ya existe una alerta “reciente” de ese tipo para la variante,
 * usando comparación de fechas en JS (sin $gte en la consulta).
 */
async function hasRecentVariantAlert(
  productId,
  sizeId,
  colorId,
  type,
  minDate
) {
  // última alerta de ese tipo para esa variante
  const last = await AdminAlert.findOne({
    product: productId,
    type,
    "variant.size": sizeId,
    "variant.color": colorId,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!last) return false;
  // Comparamos en JS. Si la última es posterior al umbral, consideramos “reciente”.
  try {
    const lastAt = new Date(last.createdAt).getTime();
    return lastAt >= minDate.getTime();
  } catch {
    return false;
  }
}

/**
 * OUT OF STOCK por variante
 */
async function emitVariantOutOfStockAlertIfNeeded(productId, sizeId, colorId) {
  debugSchemaOnce();

  // Trae SOLO la variante concreta
  const prod = await Product.findOne(
    { _id: productId, "variants.size": sizeId, "variants.color": colorId },
    { name: 1, "variants.$": 1 }
  ).lean();

  if (!prod || !prod.variants || !prod.variants[0]) return;

  const variant = prod.variants[0];
  const stock = Number(variant.stock) || 0;
  if (stock > 0) return; // No sin stock

  // Evitar duplicado: si ya hubo una hoy, no crear otra
  const today = startOfToday();
  const alreadyToday = await hasRecentVariantAlert(
    productId,
    sizeId,
    colorId,
    "OUT_OF_STOCK_VARIANT",
    today
  );
  if (alreadyToday) return;

  await AdminAlert.create({
    type: "OUT_OF_STOCK_VARIANT",
    product: productId,
    variant: { size: sizeId, color: colorId },
    message: `La variante (talla/color) de "${prod.name}" se quedó sin stock.`,
  });
}

/**
 * LOW STOCK por variante
 */
async function emitVariantLowStockAlertIfNeeded(productId, sizeId, colorId) {
  debugSchemaOnce();

  // Trae SOLO la variante concreta
  const prod = await Product.findOne(
    { _id: productId, "variants.size": sizeId, "variants.color": colorId },
    { name: 1, "variants.$": 1 }
  ).lean();

  if (!prod || !prod.variants || !prod.variants[0]) return;

  const variant = prod.variants[0];
  const stock = Number(variant.stock) || 0;

  if (stock <= 0) return; // OUT_OF_STOCK_VARIANT ya se encarga
  if (stock > LOW_STOCK_THRESHOLD) return; // No es “bajo” aún

  // Evitar spam: si ya hubo una en las últimas 24h, no crear
  const since = since24h();
  const hadRecent = await hasRecentVariantAlert(
    productId,
    sizeId,
    colorId,
    "LOW_STOCK_VARIANT",
    since
  );
  if (hadRecent) return;

  await AdminAlert.create({
    type: "LOW_STOCK_VARIANT",
    product: productId,
    variant: { size: sizeId, color: colorId },
    message: `Stock bajo en la variante (talla/color) de "${prod.name}" (stock: ${stock}).`,
  });
}

//funciones para el analicis del estado de los pedidos
async function scanAndAlertStaleOrders(io) {
  const now = Date.now();

  const candidates = await Order.find(
    {
      status: { $in: ["pendiente", "facturado", "enviado"] },
      currentStatusAt: { $type: "date" },
    },
    { status: 1, currentStatusAt: 1 }
  ).lean();

  let created = 0;

  for (const o of candidates) {
    const status = String(o.status);
    const at = new Date(o.currentStatusAt || 0).getTime();
    if (!at) continue;

    const ageMs = now - at;
    const thrMs = hoursToMs(SLA_HOURS[status] || 72);

    if (ageMs >= thrMs) {
      // Dedupe (re-alerta cada RENOTIFY_HOURS)
      const skip = await lastAlertWithin(
        o._id,
        status,
        hoursToMs(RENOTIFY_HOURS)
      );
      if (skip) continue;

      const hours = Math.floor(ageMs / (60 * 60 * 1000));
      const msg = `Pedido ${String(o._id)
        .slice(-8)
        .toUpperCase()} lleva ${hours}h en estado "${status}".`;

      const alert = await AdminAlert.create({
        type: "ORDER_STALE_STATUS",
        order: o._id,
        orderStatus: status,
        message: msg,
      });
      created++;

      // Socket.IO push a admins
      if (io && typeof io.to === "function") {
        io.to("role:admin").emit("admin:alert", {
          _id: alert._id,
          type: "ORDER_STALE_STATUS",
          order: String(o._id),
          orderStatus: status,
          message: msg,
          createdAt: alert.createdAt,
        });
      }
    }
  }

  if (created > 0) {
    console.log(
      `[orderStaleAlerts] Generadas ${created} alertas de estancamiento.`
    );
  }
}

module.exports = {
  emitVariantOutOfStockAlertIfNeeded,
  emitVariantLowStockAlertIfNeeded,
  scanAndAlertStaleOrders,
};
