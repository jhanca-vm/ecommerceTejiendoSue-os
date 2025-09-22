const express = require("express");
const router = express.Router();
const AdminAlert = require("../models/AdminAlert");

// Usa tus middlewares reales:
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "No autorizado" });
  }
  next();
};

router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/alerts
 * Query:
 *  - limit (default 10)
 *  - seen=0|1 (opcional)
 */
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const seenParam = req.query.seen;
    const filter = {};
    if (seenParam === "0") filter.seen = false;
    if (seenParam === "1") filter.seen = true;

    const [items, unread] = await Promise.all([
      AdminAlert.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        // inventario
        .populate({ path: "product", select: "name" })
        .populate({ path: "variant.size", select: "label" })
        .populate({ path: "variant.color", select: "name" })
        // pedidos estancados
        .populate({ path: "order", select: "status currentStatusAt createdAt" })
        .lean(),
      AdminAlert.countDocuments({ seen: false }),
    ]);

    res.json({ items, unread });
  } catch (e) {
    console.error("GET /admin/alerts error:", e);
    res.status(500).json({ error: "Error al obtener alertas" });
  }
});

/**
 * PATCH /api/admin/alerts/seen-all
 */
router.patch("/seen-all", async (req, res) => {
  try {
    await AdminAlert.updateMany({ seen: false }, { $set: { seen: true } });
    const unread = await AdminAlert.countDocuments({ seen: false });
    res.json({ ok: true, unread });
  } catch (e) {
    console.error("PATCH /admin/alerts/seen-all error:", e);
    res.status(500).json({ error: "No se pudo marcar como vistas" });
  }
});

/**
 * PATCH /api/admin/alerts/:id/seen
 */
router.patch("/:id/seen", async (req, res) => {
  try {
    const id = req.params.id;
    await AdminAlert.findByIdAndUpdate(id, { $set: { seen: true } });
    const unread = await AdminAlert.countDocuments({ seen: false });
    res.json({ ok: true, unread });
  } catch (e) {
    console.error("PATCH /admin/alerts/:id/seen error:", e);
    res.status(500).json({ error: "No se pudo marcar como vista" });
  }
});

module.exports = router;
