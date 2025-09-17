// controllers/messageControler.js
const { encryptText, decryptText } = require("../utils/cryptoMsg");
const Message = require("../models/Message");
const User = require("../models/User");

const MAX_LEN = 5000;
const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

/* =========================================================
 * GET /api/messages/:withUserId
 * Historial entre el usuario autenticado y :withUserId
 *  - Devuelve cada mensaje con `content` ya descifrado.
 *  - Mantiene compatibilidad con mensajes antiguos (content en claro).
 * ========================================================= */
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
      .select("+content") // ← compat: por si hay mensajes antiguos en claro
      .lean();

    const result = msgs.map((m) => {
      let content = "";
      if (m?.contentEnc?.data) {
        content = decryptText(m.contentEnc);
      } else {
        content = String(m?.content || "");
      }
      // devolvemos `content` ya listo para el front
      const { contentEnc, ...rest } = m;
      return { ...rest, content };
    });

    res.json(result);
  } catch (err) {
    console.error("getMessageHistory error:", err);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
};

/* =========================================================
 * POST /api/messages
 * Enviar mensaje
 *  - Valida, cifra y guarda en `contentEnc`.
 *  - Responde y emite por socket el mensaje con `content` descifrado.
 * ========================================================= */
exports.sendMessage = async (req, res) => {
  try {
    const { to, content, order } = req.body || {};
    const from = String(req.user.id);

    // Validaciones básicas
    if (!isObjectId(String(to))) {
      return res.status(400).json({ error: "Destino inválido" });
    }
    if (String(to) === from) {
      return res
        .status(400)
        .json({ error: "No puedes enviarte mensajes a ti mismo" });
    }
    const text = String(content || "").trim();
    if (!text || text.length > MAX_LEN) {
      return res.status(400).json({ error: "Contenido inválido" });
    }

    // Verificar existencia del destinatario
    const toUser = await User.findById(to).select("_id role").lean();
    if (!toUser)
      return res.status(404).json({ error: "Destinatario no encontrado" });

    // Guardar cifrado (NO guardamos content en claro)
    const payload = {
      from,
      to,
      order: order || undefined,
      isRead: false,
      status: "abierto",
      createdAt: new Date(),
      contentEnc: encryptText(text),
    };
    const doc = await Message.create(payload);

    // Repoblar para responder/emitir con datos del remitente/destino
    const populated = await Message.findById(doc._id)
      .populate("from", "name email role _id")
      .populate("to", "name email role _id")
      .select("+content") // compat (aunque aquí no hay content en claro)
      .lean();

    // Ensamblar respuesta con `content` descifrado
    const response = (() => {
      const { contentEnc, ...rest } = populated || {};
      return { ...rest, content: text };
    })();

    // Socket emit dirigido (rooms)
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${from}`).emit("newMessage", response);
      io.to(`user:${to}`).emit("newMessage", response);

      // Notificación a admins, si aplica
      if (toUser.role === "admin") {
        io.to("role:admin").emit("adminInboxUpdate");
      }
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error("Error al enviar mensaje", err);
    return res.status(500).json({ error: "Error al enviar mensaje" });
  }
};

/* =========================================================
 * GET /api/messages/unread/count
 * Contar mensajes no leídos para el usuario actual
 * ========================================================= */
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

/* =========================================================
 * POST /api/messages/read
 * Marcar como leídos todos los mensajes de un remitente hacia el usuario actual
 * body: { from: <userId> }
 * ========================================================= */
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { from } = req.body || {};
    if (!isObjectId(String(from))) {
      return res.status(400).json({ error: "Remitente inválido" });
    }
    await Message.updateMany(
      { from, to: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("markMessagesAsRead error:", err);
    res.status(500).json({ error: "Error al actualizar mensajes" });
  }
};

/* =========================================================
 * GET /api/messages/inbox/admin
 * Lista de usuarios con los que el admin ha conversado,
 * con preview del último mensaje (descifrado) y flag de no leídos.
 * ========================================================= */
exports.getInboxUsers = async (req, res) => {
  try {
    const adminId = String(req.user.id);

    const messages = await Message.find({
      $or: [{ from: adminId }, { to: adminId }],
    })
      .sort({ createdAt: -1 })
      .populate("from to", "name email _id")
      .select("+content") // compat mensajes antiguos
      .lean();

    const userMap = Object.create(null);

    for (const msg of messages) {
      const isFromAdmin = String(msg.from?._id) === adminId;
      const other = isFromAdmin ? msg.to : msg.from;
      if (!other?._id) continue;

      const otherId = String(other._id);
      if (userMap[otherId]) continue; // ya tomamos el más reciente por el sort

      const lastMessage =
        msg?.contentEnc?.data ? decryptText(msg.contentEnc) : String(msg?.content || "");

      const hasUnread = await Message.exists({
        from: otherId,
        to: adminId,
        isRead: false,
      });

      userMap[otherId] = {
        _id: other._id,
        name: other.name,
        email: other.email,
        lastMessage,
        lastMessageTime: msg.createdAt,
        unread: !!hasUnread,
        status: msg.status || "abierto",
      };
    }

    const inboxList = Object.values(userMap).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.json(inboxList);
  } catch (err) {
    console.error("Error en getInboxUsers:", err);
    res.status(500).json({ error: "Error al obtener inbox de admin" });
  }
};

/* =========================================================
 * GET /api/messages/conversations/list
 * Lista de conversaciones únicas del usuario actual
 * (sin cargar preview de contenido).
 * ========================================================= */
exports.getConversations = async (req, res) => {
  try {
    const userId = String(req.user.id);

    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    })
      .populate("from", "name role _id")
      .populate("to", "name role _id")
      .select("_id from to")
      .lean();

    const usersMap = Object.create(null);

    for (const msg of messages) {
      const otherUser = String(msg.from?._id) === userId ? msg.to : msg.from;
      if (!otherUser?._id) continue;
      const key = String(otherUser._id);
      if (!usersMap[key]) {
        usersMap[key] = {
          id: otherUser._id,
          name: otherUser.name,
          role: otherUser.role,
        };
      }
    }

    res.json(Object.values(usersMap));
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ error: "Error al obtener conversaciones" });
  }
};

/* =========================================================
 * POST /api/messages/status
 * Cambiar el estado de la conversación (admin <-> user)
 * body: { userId, status: "abierto" | "cerrado" | "en_espera" }
 * ========================================================= */
exports.updateConversationStatus = async (req, res) => {
  const { userId, status } = req.body || {};
  const adminId = String(req.user.id);

  if (!isObjectId(String(userId))) {
    return res.status(400).json({ error: "Usuario inválido" });
  }
  if (!["abierto", "cerrado", "en_espera"].includes(String(status))) {
    return res.status(400).json({ error: "Estado no válido" });
  }

  try {
    await Message.updateMany(
      {
        $or: [
          { from: adminId, to: userId },
          { from: userId, to: adminId },
        ],
      },
      { $set: { status } }
    );

    res.json({ success: true, message: "Estado actualizado correctamente" });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ error: "Error al actualizar estado" });
  }
};
