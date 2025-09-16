const Message = require("../models/Message");
const User = require("../models/User");

const MAX_LEN = 5000;
const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

// Obtener historial entre dos usuarios
exports.getMessageHistory = async (req, res) => {
  const { withUserId } = req.params;
  const userId = req.user.id;

  try {
    const messages = await Message.find({
      $or: [
        { from: userId, to: withUserId },
        { from: withUserId, to: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(1000)
      .populate("from", "name")
      .populate("to", "name");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
};

// Enviar mensaje
exports.sendMessage = async (req, res) => {
  try {
    const { to, content } = req.body || {};
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

    // Crear y poblar
    const message = await Message.create({ from, to, content: text });
    const populatedMessage = await message.populate(
      "from to",
      "name email role"
    );

    // Socket emit dirigido (rooms)
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${from}`).emit("newMessage", populatedMessage);
      io.to(`user:${to}`).emit("newMessage", populatedMessage);

      // Notificación solo a admins: a room de rol
      if (toUser.role === "admin") {
        io.to("role:admin").emit("adminInboxUpdate");
      }
    }

    return res.status(201).json(populatedMessage);
  } catch (err) {
    console.error("Error al enviar mensaje", err);
    return res.status(500).json({ error: "Error al enviar mensaje" });
  }
};

// Contar mensajes no leídos
exports.getUnreadMessagesCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      to: req.user.id,
      isRead: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Error al contar mensajes no leídos" });
  }
};

// Marcar como leídos
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { from } = req.body;
    await Message.updateMany(
      { from, to: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar mensajes" });
  }
};

// ✅ Obtener lista de usuarios con los que el admin ha conversado
exports.getInboxUsers = async (req, res) => {
  try {
    const adminId = req.user.id;

    const messages = await Message.find({
      $or: [{ from: adminId }, { to: adminId }],
    })
      .sort({ createdAt: -1 })
      .populate("from to", "name email");

    const userMap = {};

    for (let msg of messages) {
      const other = msg.from._id.toString() === adminId ? msg.to : msg.from;
      const otherId = other._id.toString();

      if (!userMap[otherId]) {
        const hasUnread = await Message.exists({
          from: otherId,
          to: adminId,
          isRead: false,
        });

        userMap[otherId] = {
          _id: other._id,
          name: other.name,
          email: other.email,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unread: !!hasUnread,
          status: msg.status || "abierto", // ✅ importante
        };
      }
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

// Obtener lista de usuarios con los que se ha hablado
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    })
      .populate("from", "name role")
      .populate("to", "name role");

    const usersMap = {};

    messages.forEach((msg) => {
      const otherUser = msg.from._id.equals(userId) ? msg.to : msg.from;
      if (!usersMap[otherUser._id]) {
        usersMap[otherUser._id] = {
          id: otherUser._id,
          name: otherUser.name,
          role: otherUser.role,
        };
      }
    });

    res.json(Object.values(usersMap));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener conversaciones" });
  }
};

// Cambiar el estado de un mensaje
exports.updateConversationStatus = async (req, res) => {
  const { userId, status } = req.body;
  const adminId = req.user.id;

  if (!["abierto", "cerrado", "en_espera"].includes(status)) {
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
