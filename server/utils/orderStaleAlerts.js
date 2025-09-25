const AdminAlert = require("../models/AdminAlert");
const Order = require("../models/Order");

const HOURS = (n) => n * 60 * 60 * 1000;

// Umbrales por estado (horas) – configurables por .env
const SLA_HOURS = {
  pendiente: Number(process.env.ORDER_SLA_PENDIENTE_HOURS || 72),
  facturado: Number(process.env.ORDER_SLA_FACTURADO_HOURS || 72),
  enviado: Number(process.env.ORDER_SLA_ENVIADO_HOURS || 72),
};

// Re-notificación cada N horas para el mismo pedido/estado
const RENOTIFY_HOURS = Number(process.env.ORDER_STALE_RENOTIFY_HOURS || 24);

// Tipos de estados a vigilar
const WATCH_STATUSES = ["pendiente", "facturado", "enviado"];

async function lastStaleAlertAt(orderId, status) {
  const last = await AdminAlert.findOne({
    type: "ORDER_STALE_STATUS",
    order: orderId,
    orderStatus: status,
  })
    .sort({ createdAt: -1 })
    .lean();
  return last ? new Date(last.createdAt) : null;
}

async function emitOrderStaleAlert(order, status, io) {
  const msg = `Pedido #${String(order._id).slice(-8).toUpperCase()} estancado en estado "${status}" desde ${new Date(order.currentStatusAt).toLocaleString()}.`;

  const alert = await AdminAlert.create({
    type: "ORDER_STALE_STATUS",
    order: order._id,
    orderStatus: status,
    message: msg,
    seen: false,
  });

  // Opcional: emitir por sockets a admins
  try {
    if (io) {
      io.to("role:admin").emit("admin:alert", {
        _id: alert._id,
        type: alert.type,
        order: { _id: order._id, status },
        message: msg,
        createdAt: alert.createdAt,
      });
    }
  } catch (_) {}
}

async function checkStaleOrders({ io } = {}) {
  const now = Date.now();
  const candidates = await Order.find(
    { status: { $in: WATCH_STATUSES } },
    { status: 1, currentStatusAt: 1 }
  )
    .sort({ currentStatusAt: 1 })
    .lean();

  for (const o of candidates) {
    if (!o.currentStatusAt) continue;
    const status = o.status;
    const hours = SLA_HOURS[status] || 72;
    const ageMs = now - new Date(o.currentStatusAt).getTime();
    if (ageMs < HOURS(hours)) continue;

    // deduplicar por re-notify window
    const last = await lastStaleAlertAt(o._id, status);
    if (last && now - last.getTime() < HOURS(RENOTIFY_HOURS)) continue;

    await emitOrderStaleAlert(o, status, io);
  }
}

module.exports = {
  checkStaleOrders,
  SLA_HOURS,
};
