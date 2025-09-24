const AdminAlert = require("../models/AdminAlert");
const Product = require("../models/Product");
const Order = require("../models/Order");

const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 3);
const RENOTIFY_HOURS = Number(process.env.ORDER_STALE_RENOTIFY_HOURS || 24);

// SLA por estado (horas) para estancados
const SLA_HOURS = {
  pendiente: Number(process.env.SLA_H_PENDIENTE || 24),
  facturado: Number(process.env.SLA_H_FACTURADO || 48),
  enviado: Number(process.env.SLA_H_ENVIADO || 72),
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const since24h = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
const hoursToMs = (h) => Number(h) * 60 * 60 * 1000;

/** ===== Helpers ===== */
function debugSchemaOnce() {
  if (debugSchemaOnce._done) return;
  try {
    const inst = AdminAlert.schema?.path("createdAt")?.instance;
    console.log("[AdminAlert] createdAt instance:", inst);
  } catch {}
  debugSchemaOnce._done = true;
}

async function hasRecentVariantAlert(
  productId,
  sizeId,
  colorId,
  type,
  minDate
) {
  const last = await AdminAlert.findOne({
    product: productId,
    type,
    "variant.size": sizeId,
    "variant.color": colorId,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!last) return false;
  try {
    const lastAt = new Date(last.createdAt).getTime();
    return lastAt >= minDate.getTime();
  } catch {
    return false;
  }
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

/** Crear y emitir una alerta a admins */
async function createAndEmit(alertDoc, io) {
  const alert = await AdminAlert.create({ seen: false, ...alertDoc });
  try {
    if (io && typeof io.to === "function") {
      io.to("role:admin").emit("admin:alert", {
        _id: alert._id,
        type: alert.type,
        product: alert.product,
        variant: alert.variant,
        order: alert.order,
        orderStatus: alert.orderStatus,
        message: alert.message,
        seen: alert.seen,
        createdAt: alert.createdAt,
      });
    }
  } catch (e) {
    console.warn("[admin:alert] emit error:", e?.message || e);
  }
  return alert;
}

/** ===== Inventario ===== */
async function emitVariantOutOfStockAlertIfNeeded(
  productId,
  sizeId,
  colorId,
  io
) {
  debugSchemaOnce();

  const prod = await Product.findOne(
    { _id: productId, "variants.size": sizeId, "variants.color": colorId },
    { name: 1, "variants.$": 1 }
  ).lean();

  if (!prod || !prod.variants || !prod.variants[0]) return;

  const variant = prod.variants[0];
  const stock = Number(variant.stock) || 0;
  if (stock > 0) return;

  const today = startOfToday();
  const alreadyToday = await hasRecentVariantAlert(
    productId,
    sizeId,
    colorId,
    "OUT_OF_STOCK_VARIANT",
    today
  );
  if (alreadyToday) return;

  await createAndEmit(
    {
      type: "OUT_OF_STOCK_VARIANT",
      product: productId,
      variant: { size: sizeId, color: colorId },
      message: `La variante (talla/color) de "${prod.name}" se quedó sin stock.`,
    },
    io
  );
}

async function emitVariantLowStockAlertIfNeeded(
  productId,
  sizeId,
  colorId,
  io
) {
  debugSchemaOnce();

  const prod = await Product.findOne(
    { _id: productId, "variants.size": sizeId, "variants.color": colorId },
    { name: 1, "variants.$": 1 }
  ).lean();

  if (!prod || !prod.variants || !prod.variants[0]) return;

  const variant = prod.variants[0];
  const stock = Number(variant.stock) || 0;

  if (stock <= 0) return; // OUT_OF_STOCK_VARIANT ya se encarga
  if (stock > LOW_STOCK_THRESHOLD) return;

  const since = since24h();
  const hadRecent = await hasRecentVariantAlert(
    productId,
    sizeId,
    colorId,
    "LOW_STOCK_VARIANT",
    since
  );
  if (hadRecent) return;

  await createAndEmit(
    {
      type: "LOW_STOCK_VARIANT",
      product: productId,
      variant: { size: sizeId, color: colorId },
      message: `Stock bajo en la variante (talla/color) de "${prod.name}" (stock: ${stock}).`,
    },
    io
  );
}

/** ===== Pedidos (estancados) ===== */
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

      await createAndEmit(
        {
          type: "ORDER_STALE_STATUS",
          order: o._id,
          orderStatus: status,
          message: msg,
        },
        io
      );
      created++;
    }
  }

  if (created > 0) {
    console.log(
      `[orderStaleAlerts] Generadas ${created} alertas de estancamiento.`
    );
  }
}

/** ===== Pedidos (nuevos / cambios de estado) ===== */
async function emitOrderCreatedAlert(orderDoc, io) {
  const short = String(orderDoc._id).slice(-8).toUpperCase();
  return createAndEmit(
    {
      type: "ORDER_CREATED",
      order: orderDoc._id,
      orderStatus: orderDoc.status || "pendiente",
      message: `Nuevo pedido #${short} creado (${
        orderDoc.items?.length || 0
      } ítems).`,
    },
    io
  );
}

async function emitOrderStatusChangedAlert(orderDoc, prevStatus, io) {
  const to = String(orderDoc.status);
  const short = String(orderDoc._id).slice(-8).toUpperCase();
  if (prevStatus === to) return null;
  return createAndEmit(
    {
      type: "ORDER_STATUS_CHANGED",
      order: orderDoc._id,
      orderStatus: to,
      message: `Pedido #${short}: estado "${prevStatus || "—"}" → "${to}".`,
    },
    io
  );
}

module.exports = {
  // inventario
  emitVariantOutOfStockAlertIfNeeded,
  emitVariantLowStockAlertIfNeeded,
  // pedidos
  scanAndAlertStaleOrders,
  emitOrderCreatedAlert,
  emitOrderStatusChangedAlert,
};
