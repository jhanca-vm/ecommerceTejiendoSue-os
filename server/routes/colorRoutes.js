const express = require("express");
const router = express.Router();
const {
  getColors,
  createColor,
  updateColor,
  deleteColor,
} = require("../controllers/colorController");
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  objectIdParam,
  nameValidators,
  handleValidationErrors,
} = require("../middleware/validation");

// Públicas
router.get("/", getColors);

// Admin
router.post(
  "/",
  verifyToken,
  isAdmin,
  nameValidators("name"),
  handleValidationErrors,
  createColor
);

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  objectIdParam("id"),
  nameValidators("name"),
  handleValidationErrors,
  updateColor
);

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  objectIdParam("id"),
  handleValidationErrors,
  deleteColor
);

module.exports = router;
