// controllers/sizeController.js
const Size = require("../models/Size");

exports.getSizes = async (_req, res) => {
  const rows = await Size.find().sort({ label: 1 });
  res.json(rows);
};

exports.createSize = async (req, res) => {
  try {
    const raw = (req.body?.label ?? req.body?.name ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "label requerido" });

    const s = await Size.create({ label: raw });
    res.status(201).json(s);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(400).json({ error: "La talla ya existe" });
    }
    res.status(500).json({ error: "Error al crear talla" });
  }
};

exports.updateSize = async (req, res) => {
  try {
    const raw = (req.body?.label ?? req.body?.name ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "label requerido" });

    const up = await Size.findByIdAndUpdate(
      req.params.id,
      { $set: { label: raw } },
      { new: true, runValidators: true }
    );
    if (!up) return res.status(404).json({ error: "No encontrado" });
    res.json(up);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(400).json({ error: "La talla ya existe" });
    }
    res.status(500).json({ error: "Error al actualizar talla" });
  }
};

exports.deleteSize = async (req, res) => {
  const del = await Size.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
};
