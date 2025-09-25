const { encryptText, decryptText } = require("../utils/cryptoMsg");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

const MAX_LEN = 5000;
const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

// ========= Helpers soporte =========
function parseSupportAgents() {
  const raw = process.env.SUPPORT_AGENT_IDS || "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-fA-F]{24}$/.test(s));
  return list;
}

async function pickSupportAgent() {
  const ids = parseSupportAgents();
  if (!ids.length) return null;
  // Simple: usa el primero válido que exista y sea admin
  const agent = await User.findOne({ _id: { $in: ids }, role: "admin" })
    .select("_id role name email")
    .lean();
  return agent ? String(agent._id) : null;
}

async function ensureConversation({ userId, adminId }) {
  // Busca una conversación no cerrada entre user y admin
  let convo = await Conversation.findOne({
    user: userId,
    assignedTo: adminId,
    status: { $ne: "cerrado" },
  });
  if (!convo) {
    convo = await Conversation.create({
      user: userId,
      assignedTo: adminId,
      status: "abierto",
      readPointers: { user: null, admin: null },
      lastMessageAt: null,
      lastMessagePreview: "",
    });
  }
  return convo;
}

function canSeeSupport(adminId) {
  const ids = parseSupportAgents();
  return ids.includes(String(adminId));
}

// =========================================================
// NUEVO: POST /api/messages/conversations/open
// - User: crea/obtiene conversación asignando un agente de soporte.
// - Admin: con { withUserId } abre/obtiene conversación con ese user.
// =========================================================
exports.getOrCreateConversation = async (req, res) => {
  try {
    const uid = String(req.user.id);
    const role = String(req.user.role || "user");
    const { withUserId } = req.body || {};

    if (role === "user") {
      const agentId = await pickSupportAgent();
      if (!agentId)
        return res.status(503).json({ error: "Soporte no disponible" });
      const convo = await ensureConversation({ userId: uid, adminId: agentId });
      return res.json({
        conversationId: String(convo._id),
        userId: uid,
        adminId: agentId,
        status: convo.status,
      });
    }

    // Admin
    if (!isObjectId(String(withUserId))) {
      return res.status(400).json({ error: "withUserId inválido" });
    }
    if (!canSeeSupport(uid)) {
      return res.status(403).json({ error: "No autorizado para soporte" });
    }
    const convo = await ensureConversation({
      userId: String(withUserId),
      adminId: uid,
    });
    return res.json({
      conversationId: String(convo._id),
      userId: String(withUserId),
      adminId: uid,
      status: convo.status,
    });
  } catch (err) {
    console.error("getOrCreateConversation error:", err);
    return res.status(500).json({ error: "Error al abrir conversación" });
  }
};

// =========================================================
// GET /api/messages/history/conversation/:conversationId
// Historial por conversación (paginado)
// query: ?limit=50&before=<ISO|ms>
// =========================================================
exports.getMessageHistoryByConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const uid = String(req.user.id);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    if (!isObjectId(String(conversationId))) {
      return res.status(400).json({ error: "conversationId inválido" });
    }

    const convo = await Conversation.findById(conversationId)
      .populate("user", "name _id")
      .populate("assignedTo", "name _id role")
      .lean();
    if (!convo)
      return res.status(404).json({ error: "Conversación no encontrada" });

    // Autorización: participante
    const isUser = String(convo.user?._id) === uid;
    const isAdmin = String(convo.assignedTo?._id) === uid;
    if (!isUser && !isAdmin) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const criteria = { conversationId };
    if (before && !isNaN(before)) {
      criteria.createdAt = { $lt: before };
    }

    const msgs = await Message.find(criteria)
      .sort({ createdAt: -1 }) // del más nuevo hacia atrás
      .limit(limit)
      .populate("from", "name _id")
      .populate("to", "name _id")
      .select("+content")
      .lean();

    const result = msgs
      .reverse() // devolver ascendente
      .map((m) => {
        const c = m?.contentEnc?.data
          ? decryptText(m.contentEnc)
          : String(m?.content || "");
        const { contentEnc, ...rest } = m;
        return { ...rest, content: c };
      });

    res.json({
      conversation: {
        id: String(convo._id),
        user: convo.user,
        assignedTo: convo.assignedTo,
        status: convo.status,
        readPointers: convo.readPointers || {},
        lastMessageAt: convo.lastMessageAt,
      },
      messages: result,
    });
  } catch (err) {
    console.error("getMessageHistoryByConversation error:", err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
};

// =========================================================
// (MEJORADO) POST /api/messages
// - Ahora puede recibir { conversationId } o { to } (legacy).
// - Actualiza Conversation.lastMessage*, setea conversationId en Message.
// - Emite eventos a ambos participantes y actualiza inbox del admin asignado.
// =========================================================
exports.sendMessage = async (req, res) => {
  try {
    const { to, content, order, conversationId } = req.body || {};
    const from = String(req.user.id);
    const role = String(req.user.role || "user");

    const text = String(content || "").trim();
    if (!text || text.length > MAX_LEN) {
      return res.status(400).json({ error: "Contenido inválido" });
    }

    let convo = null;
    let targetId = null;

    if (conversationId) {
      if (!isObjectId(String(conversationId))) {
        return res.status(400).json({ error: "conversationId inválido" });
      }
      convo = await Conversation.findById(conversationId).lean();
      if (!convo)
        return res.status(404).json({ error: "Conversación no encontrada" });

      const isUser = String(convo.user) === from;
      const isAdmin = String(convo.assignedTo) === from;
      if (!isUser && !isAdmin) {
        return res.status(403).json({ error: "No autorizado" });
      }
      targetId = isUser ? String(convo.assignedTo) : String(convo.user);
    } else {
      // LEGACY: usar "to" y derivar/construir conversación
      if (!isObjectId(String(to))) {
        return res.status(400).json({ error: "Destino inválido" });
      }
      if (String(to) === from) {
        return res
          .status(400)
          .json({ error: "No puedes enviarte mensajes a ti mismo" });
      }
      const toUser = await User.findById(to).select("_id role").lean();
      if (!toUser)
        return res.status(404).json({ error: "Destinatario no encontrado" });

      // Determinar roles y asegurar conversación
      if (role === "user") {
        const agentId = await pickSupportAgent();
        const adminId =
          agentId || (toUser.role === "admin" ? String(toUser._id) : null);
        if (!adminId)
          return res.status(503).json({ error: "Soporte no disponible" });
        convo = await ensureConversation({ userId: from, adminId });
        targetId = String(convo.assignedTo);
      } else {
        // admin enviando a un user
        if (!canSeeSupport(from))
          return res.status(403).json({ error: "No autorizado para soporte" });
        convo = await ensureConversation({
          userId: String(toUser._id),
          adminId: from,
        });
        targetId = String(toUser._id);
      }
    }

    // Guardar cifrado
    const payload = {
      conversationId: convo ? convo._id : null,
      from,
      to: targetId,
      order: order || undefined,
      isRead: false,
      status: "abierto",
      createdAt: new Date(),
      contentEnc: encryptText(text),
    };
    const doc = await Message.create(payload);

    // Actualizar conversación (preview/fecha/estado)
    await Conversation.updateOne(
      { _id: payload.conversationId },
      {
        $set: {
          lastMessageAt: payload.createdAt,
          lastMessagePreview: text.slice(0, 180),
          status: "abierto",
        },
      }
    );

    // Respuesta poblada
    const populated = await Message.findById(doc._id)
      .populate("from", "name email role _id")
      .populate("to", "name email role _id")
      .select("+content")
      .lean();

    const response = (() => {
      const { contentEnc, ...rest } = populated || {};
      return { ...rest, content: text };
    })();

    // Sockets
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${from}`).emit("newMessage", response);
      io.to(`user:${targetId}`).emit("newMessage", response);

      // Notificar al admin asignado su inbox (solo a ese admin, no a todos)
      io.to(`user:${String(convo.assignedTo)}`).emit("adminInboxUpdate", {
        conversationId: String(convo._id),
        lastMessageAt: payload.createdAt,
      });
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error("Error al enviar mensaje", err);
    return res.status(500).json({ error: "Error al enviar mensaje" });
  }
};

// =========================================================
// (MEJORADO) GET /api/messages/inbox/admin
// - Lista basada en Conversation asignadas a ESTE admin
// - Requiere que el admin esté en SUPPORT_AGENT_IDS
// =========================================================
exports.getInboxUsers = async (req, res) => {
  try {
    const adminId = String(req.user.id);
    if (!canSeeSupport(adminId)) {
      // Para que "no les aparezca soporte" a otros admins
      return res.json([]); // o res.status(403).json({ error: "No autorizado para soporte" });
    }

    const convos = await Conversation.find({ assignedTo: adminId })
      .populate("user", "name email _id")
      .sort({ lastMessageAt: -1 })
      .lean();

    // Para cada conversación, calcula unread de forma rápida:
    // unread = existe mensaje isRead:false hacia admin en esa conversación
    const results = await Promise.all(
      convos.map(async (c) => {
        const hasUnread = await Message.exists({
          conversationId: c._id,
          to: adminId,
          isRead: false,
        });
        return {
          _id: c.user?._id,
          name: c.user?.name || "Usuario",
          email: c.user?.email || "",
          lastMessage: c.lastMessagePreview || "",
          lastMessageTime: c.lastMessageAt,
          unread: !!hasUnread,
          status: c.status || "abierto",
          conversationId: String(c._id),
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Error en getInboxUsers:", err);
    res.status(500).json({ error: "Error al obtener inbox de admin" });
  }
};

// =========================================================
// (COMPAT) GET /api/messages/:withUserId
// Mantiene compatibilidad (legacy) descifrando content.
// =========================================================
exports.getMessageHistory = async (req, res) => {
  const { withUserId } = req.params;
  const userId = String(req.user.id);

  try {
    const msgs = await Message.find({
      $or: [
        { from: userId, to: withUserId },
        { from: withUserId, to: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(1000)
      .populate("from", "name _id")
      .populate("to", "name _id")
      .select("+content")
      .lean();

    const result = msgs.map((m) => {
      const content = m?.contentEnc?.data
        ? decryptText(m.contentEnc)
        : String(m?.content || "");
      const { contentEnc, ...rest } = m;
      return { ...rest, content };
    });

    res.json(result);
  } catch (err) {
    console.error("getMessageHistory error:", err);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
};

// =========================================================
// GET /api/messages/unread/count (igual que antes)
// =========================================================
exports.getUnreadMessagesCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      to: req.user.id,
      isRead: false,
    });
    res.json({ count });
  } catch (err) {
    console.error("getUnreadMessagesCount error:", err);
    res.status(500).json({ error: "Error al contar mensajes no leídos" });
  }
};

// =========================================================
/* (MEJORADO) POST /api/messages/read
 * Legacy: marca como leídos los mensajes de "from" -> yo
 * AHORA: además emite "adminInboxUpdate" y "support:readReceipt"
 */
// =========================================================
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { from } = req.body || {};
    if (!isObjectId(String(from))) {
      return res.status(400).json({ error: "Remitente inválido" });
    }

    const myId = String(req.user.id);
    const result = await Message.updateMany(
      { from, to: myId, isRead: false },
      { $set: { isRead: true } }
    );

    // Emitir para actualizar inbox y recibos
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${myId}`).emit("adminInboxUpdate"); // si es admin verá cambios al instante
      io.to(`user:${from}`).emit("support:readReceipt", {
        by: myId,
        at: Date.now(),
      });
    }

    res.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error("markMessagesAsRead error:", err);
    res.status(500).json({ error: "Error al actualizar mensajes" });
  }
};

// =========================================================
// NUEVO: POST /api/messages/conversation/read
// body: { conversationId }
// - Marca como leídos los mensajes hacia mí en esa conversación
// - Actualiza readPointers.{user|admin}
// - Emite readReceipt y adminInboxUpdate
// =========================================================
exports.markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.body || {};
    const myId = String(req.user.id);
    const myRole = String(req.user.role || "user");

    if (!isObjectId(String(conversationId))) {
      return res.status(400).json({ error: "conversationId inválido" });
    }

    const convo = await Conversation.findById(conversationId).lean();
    if (!convo)
      return res.status(404).json({ error: "Conversación no encontrada" });

    const isUser = String(convo.user) === myId;
    const isAdmin = String(convo.assignedTo) === myId;
    if (!isUser && !isAdmin)
      return res.status(403).json({ error: "No autorizado" });

    const result = await Message.updateMany(
      { conversationId, to: myId, isRead: false },
      { $set: { isRead: true } }
    );

    const now = new Date();
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          [`readPointers.${isUser ? "user" : "admin"}`]: now,
        },
      }
    );

    const io = req.app.get("io");
    if (io) {
      const otherId = isUser ? String(convo.assignedTo) : String(convo.user);
      io.to(`user:${otherId}`).emit("support:readReceipt", {
        conversationId,
        by: myId,
        at: now,
      });
      // Actualiza inbox del admin asignado (no broadcast a todos)
      io.to(`user:${String(convo.assignedTo)}`).emit("adminInboxUpdate", {
        conversationId,
        at: now,
      });
    }

    res.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error("markConversationAsRead error:", err);
    res.status(500).json({ error: "Error al marcar como leído" });
  }
};

// =========================================================
// GET /api/messages/conversations/list (usuario o admin)
// - Devuelve pares con el "otro" participante + conversationId
// =========================================================
exports.getConversations = async (req, res) => {
  try {
    const uid = String(req.user.id);
    const role = String(req.user.role || "user");

    let convos;
    if (role === "admin") {
      if (!canSeeSupport(uid)) return res.json([]);
      convos = await Conversation.find({ assignedTo: uid })
        .populate("user", "name role _id")
        .sort({ lastMessageAt: -1 })
        .lean();
      const out = convos.map((c) => ({
        id: c.user?._id,
        name: c.user?.name,
        role: "user",
        conversationId: String(c._id),
        status: c.status,
      }));
      return res.json(out);
    }

    // user
    convos = await Conversation.find({ user: uid })
      .populate("assignedTo", "name role _id")
      .sort({ lastMessageAt: -1 })
      .lean();
    const out = convos.map((c) => ({
      id: c.assignedTo?._id,
      name: c.assignedTo?.name,
      role: "admin",
      conversationId: String(c._id),
      status: c.status,
    }));
    return res.json(out);
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ error: "Error al obtener conversaciones" });
  }
};

// =========================================================
// POST /api/messages/status
// Cambia estado a nivel de Conversation (y opcionalmente marca mensajes)
// =========================================================
exports.updateConversationStatus = async (req, res) => {
  const { userId, status } = req.body || {};
  const adminId = String(req.user.id);

  if (!isObjectId(String(userId))) {
    return res.status(400).json({ error: "Usuario inválido" });
  }
  if (!["abierto", "cerrado", "en_espera"].includes(String(status))) {
    return res.status(400).json({ error: "Estado no válido" });
  }
  if (!canSeeSupport(adminId)) {
    return res.status(403).json({ error: "No autorizado para soporte" });
  }

  try {
    const convo = await Conversation.findOneAndUpdate(
      { user: userId, assignedTo: adminId, status: { $ne: status } },
      { $set: { status } },
      { new: true }
    ).lean();

    // Opcional: propagar el "status" en mensajes recientes (no necesario para lógica)
    await Message.updateMany(
      {
        conversationId: convo?._id || null,
        $or: [
          { from: adminId, to: userId },
          { from: userId, to: adminId },
        ],
      },
      { $set: { status } }
    );

    const io = req.app.get("io");
    if (io && convo) {
      io.to(`user:${adminId}`).emit("adminInboxUpdate", {
        conversationId: String(convo._id),
      });
    }

    res.json({ success: true, message: "Estado actualizado correctamente" });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ error: "Error al actualizar estado" });
  }
};
