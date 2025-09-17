const express = require("express");
const rateLimit = require("express-rate-limit");
const { verifyToken, isAdmin, requireVerified  } = require("../middleware/auth");

const {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  updateOrderStatus,
  getOrderById,
  updateOrder,
  cancelOrder,
  getAllOrderIds,
  getGlobalSalesHistory,
} = require("../controllers/orderController");

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: "Demasiadas solicitudes, intenta más tarde.",
});

// Listado admin y reportes
router.get("/", verifyToken, isAdmin, getAllOrders);
router.get("/sales-history", orderLimiter, verifyToken, isAdmin, getGlobalSalesHistory);
router.get("/ids", verifyToken, isAdmin, getAllOrderIds);

// Usuario autenticado
router.get("/my", verifyToken, getMyOrders);
router.get("/my/:id", verifyToken, getMyOrderById);

// CRUD/acciones sobre una orden
router.get("/:id", verifyToken, isAdmin, getOrderById);
router.post("/", orderLimiter, verifyToken, createOrder);
router.put("/:id", orderLimiter, verifyToken, isAdmin, updateOrder);
router.patch("/:id/status", verifyToken, isAdmin, updateOrderStatus);
router.post("/:id/cancel", verifyToken, isAdmin, cancelOrder);

module.exports = router;
