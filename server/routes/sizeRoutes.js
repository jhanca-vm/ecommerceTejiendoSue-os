const express = require("express");
const router = express.Router();
const {
  getSizes,
  createSize,
  updateSize,
  deleteSize,
} = require("../controllers/sizeController");
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  objectIdParam,
  nameValidators,
  handleValidationErrors,
} = require("../middleware/validation");

// Públicas
router.get("/", getSizes);

// Admin
router.post(
  "/",
  verifyToken,
  isAdmin,
  nameValidators("label"), // asumiendo que Size usa "label"
  handleValidationErrors,
  createSize
);

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  objectIdParam("id"),
  nameValidators("label"),
  handleValidationErrors,
  updateSize
);

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  objectIdParam("id"),
  handleValidationErrors,
  deleteSize
);

module.exports = router;
