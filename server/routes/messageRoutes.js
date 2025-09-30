const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  openConversation,
  getMessageHistoryByConversation,
  markConversationAsRead,
  getMessageHistory,
  sendMessage,
  getUnreadMessagesCount,
  markMessagesAsRead,
  getInboxUsers,
  getConversations,
  updateConversationStatus,
  createMessage,
} = require("../controllers/messageControler");

const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const markReadLimiter = rateLimit({
  windowMs: 10 * 1000, 
  max: 8, 
  standardHeaders: true,
  legacyHeaders: false,
});

const inboxReadLimiter = rateLimit({
  windowMs: 10 * 1000, 
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function validateSendMessage(req, res, next) {
  const { to, content, conversationId } = req.body || {};
  if (!conversationId) {
    if (!to || typeof to !== "string" || !/^[0-9a-fA-F]{24}$/.test(to)) {
      return res.status(400).json({ error: "Destino inválido" });
    }
  }
  const text = String(content || "").trim();
  if (!text || text.length > 5000) {
    return res.status(400).json({ error: "Contenido inválido" });
  }
  req.body.content = text;
  next();
}

router.post("/conversations/open", verifyToken, openConversation);
router.get(
  "/history/conversation/:conversationId",
  verifyToken,
  getMessageHistoryByConversation
);

router.post(
  "/conversation/read",
  verifyToken,
  markReadLimiter,
  markConversationAsRead
);

router.get(
  "/unread/count",
  verifyToken,
  inboxReadLimiter,
  getUnreadMessagesCount
);
router.get(
  "/inbox/admin",
  verifyToken,
  isAdmin,
  inboxReadLimiter,
  getInboxUsers
);
router.get(
  "/conversations/list",
  verifyToken,
  inboxReadLimiter,
  getConversations
);

// Envío de mensajes con limiter dedicado
router.post(
  "/",
  verifyToken,
  sendMessageLimiter,
  validateSendMessage,
  createMessage
);

// (legacy)
router.get("/:withUserId", verifyToken, getMessageHistory);

module.exports = router;
