const Category = require("../models/Category");
const { slugify } = require("../models/Category");

// Helpers locales
const ALLOWED_SECTIONS = new Set(["artesanias", "cafe", "panela", "otros"]);
const normSection = (s) => {
  const v = String(s || "")
    .toLowerCase()
    .trim();
  return ALLOWED_SECTIONS.has(v) ? v : "artesanias"; // default conservador
};

// Crear categoría
exports.createCategory = async (req, res) => {
  try {
    const { name, description = "", slug, menuSection } = req.body;
    const finalSlug = slug ? slugify(slug) : slugify(name);

    const existsByName = await Category.findOne({ name });
    const existsBySlug = await Category.findOne({ slug: finalSlug });
    if (existsByName || existsBySlug) {
      return res
        .status(400)
        .json({ error: "La categoría ya existe (nombre o slug duplicado)." });
    }

    const category = new Category({
      name,
      description,
      slug: finalSlug,
      menuSection: normSection(menuSection),
    });

    await category.save();
    res.status(201).json(category);
  } catch (err) {
    console.error("Error al crear categoría:", err);
    res.status(500).json({ error: "Error al crear la categoría" });
  }
};

// Obtener todas
exports.getAllCategories = async (_req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      sortPriority: -1,
      name: 1,
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener categorías" });
  }
};

// Obtener por ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category)
      return res.status(404).json({ error: "Categoría no encontrada" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar categoría" });
  }
};

// Obtener por SLUG (nuevo)
exports.getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({
      slug: String(req.params.slug || "").toLowerCase(),
      isActive: true,
    });
    if (!category)
      return res.status(404).json({ error: "Categoría no encontrada" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar categoría por slug" });
  }
};

// Actualizar
exports.updateCategory = async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.slug) patch.slug = slugify(patch.slug);
    if (patch.name && !patch.slug) patch.slug = slugify(patch.name);

    // === NUEVO ===
    if (patch.menuSection !== undefined) {
      patch.menuSection = normSection(patch.menuSection);
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });
    if (!updated)
      return res.status(404).json({ error: "Categoría no encontrada" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar la categoría" });
  }
};

// Eliminar
exports.deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Categoría no encontrada" });
    res.json({ message: "Categoría eliminada correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};
