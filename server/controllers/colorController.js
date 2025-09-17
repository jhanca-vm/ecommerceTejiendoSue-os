const Color = require("../models/Color");

exports.getColors = async (_req, res) => {
  const rows = await Color.find().sort({ name: 1 });
  res.json(rows);
};

exports.createColor = async (req, res) => {
  try {
    const raw = (req.body?.name ?? req.body?.label ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "name requerido" });

    const c = await Color.create({ name: raw });
    res.status(201).json(c);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(400).json({ error: "El color ya existe" });
    }
    res.status(500).json({ error: "Error al crear color" });
  }
};

exports.updateColor = async (req, res) => {
  try {
    const raw = (req.body?.name ?? req.body?.label ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "name requerido" });

    const up = await Color.findByIdAndUpdate(
      req.params.id,
      { $set: { name: raw } },
      { new: true, runValidators: true }
    );
    if (!up) return res.status(404).json({ error: "No encontrado" });
    res.json(up);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(400).json({ error: "El color ya existe" });
    }
    res.status(500).json({ error: "Error al actualizar color" });
  }
};

exports.deleteColor = async (req, res) => {
  const del = await Color.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
};
