const express = require("express");
const router = express.Router();
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  objectIdParam,
  nameValidators,
  handleValidationErrors,
} = require("../middleware/validation");

// Públicas
router.get("/", getAllCategories);
router.get("/slug/:slug", getCategoryBySlug);
router.get(
  "/:id",
  objectIdParam("id"),
  handleValidationErrors,
  getCategoryById
);

// Admin
router.post(
  "/",
  verifyToken,
  isAdmin,
  nameValidators("name"),
  handleValidationErrors,
  createCategory
);
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  objectIdParam("id"),
  nameValidators("name"),
  handleValidationErrors,
  updateCategory
);
router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  objectIdParam("id"),
  handleValidationErrors,
  deleteCategory
);

module.exports = router;
