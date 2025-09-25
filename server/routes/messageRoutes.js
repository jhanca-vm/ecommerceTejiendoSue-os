// routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  getOrCreateConversation,
  getMessageHistoryByConversation,
  markConversationAsRead,
  getMessageHistory,
  sendMessage,
  getUnreadMessagesCount,
  markMessagesAsRead,
  getInboxUsers,
  getConversations,
  updateConversationStatus,
} = require("../controllers/messageControler");

const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function validateSendMessage(req, res, next) {
  const { to, content, conversationId } = req.body || {};
  // Permitir EITHER to OR conversationId (compatibilidad + nuevo flujo)
  if (!conversationId) {
    if (!to || typeof to !== "string" || !/^[0-9a-fA-F]{24}$/.test(to)) {
      return res.status(400).json({ error: "Destino inválido" });
    }
  }
  const text = String(content || "").trim();
  if (!text || text.length > 5000) {
    return res.status(400).json({ error: "Contenido inválido" });
  }
  req.body.content = text; // normaliza
  next();
}

// ===== NUEVAS RUTAS PARA CONVERSACIONES =====
router.post("/conversations/open", verifyToken, getOrCreateConversation);
router.get(
  "/history/conversation/:conversationId",
  verifyToken,
  getMessageHistoryByConversation
);
router.post("/conversation/read", verifyToken, markConversationAsRead);

// ===== EXISTENTES (compat) =====
router.get("/unread/count", verifyToken, getUnreadMessagesCount);
router.post("/read", verifyToken, markMessagesAsRead);
router.get("/inbox/admin", verifyToken, isAdmin, getInboxUsers);
router.get("/conversations/list", verifyToken, getConversations);
router.post("/status", verifyToken, isAdmin, updateConversationStatus);

router.post(
  "/",
  verifyToken,
  sendMessageLimiter,
  validateSendMessage,
  sendMessage
);
router.get("/:withUserId", verifyToken, getMessageHistory);

module.exports = router;
