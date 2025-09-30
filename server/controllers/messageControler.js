const mongoose = require("mongoose");
const { encryptText, decryptText } = require("../utils/cryptoMsg");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const { Types } = mongoose;

const MAX_LEN = 5000;
const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

// ========= Helpers soporte =========
function normalizeSupportIds(raw) {
  if (!raw || typeof raw !== "string") return [];
  const s = raw.trim();
  let list = [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) list = parsed.map(String);
  } catch {
    list = s
      .split(",")
      .map((x) => x.replace(/["'\s]/g, ""))
      .filter(Boolean);
  }
  return list.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
}

function sanitizeText(input, maxLen = 2000) {
  const t = String(input || "");
  const normalized = t.normalize("NFKC").replace(/[^\S\n\t\r]/g, " ");
  const withoutCtrls = normalized.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );
  return withoutCtrls.trim().slice(0, maxLen);
}

function parseSupportAgents() {
  return (process.env.SUPPORT_AGENT_IDS || "")
    .split(",")
    .map((s) => s.trim().replace(/["']/g, ""))
    .filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
}

async function pickSupportAgent() {
  const ids = parseSupportAgents();
  for (const id of ids) {
    const admin = await User.findOne({ _id: id, role: "admin" })
      .select("_id role name email")
      .lean();
    if (admin) return String(admin._id);
  }
  return null;
}

function canSeeSupport(adminId) {
  return parseSupportAgents().includes(String(adminId));
}

/**
 * Devuelve la única conversación del usuario. Si no existe, la crea
 * y **siempre** asegura assignedTo.
 */
async function ensureUserConversation(userId, preferredAdminId = null) {
  let conv = await Conversation.findOne({ user: userId }).lean();

  let adminId = preferredAdminId;
  if (!adminId) adminId = await pickSupportAgent();
  if (!adminId)
    throw Object.assign(new Error("No hay agentes de soporte disponibles"), {
      status: 503,
    });

  // 3) crea o completa assignedTo
  if (!conv) {
    conv = await Conversation.create({
      user: userId,
      assignedTo: adminId,
      status: "abierto",
      readPointers: { user: null, admin: null },
      lastMessageAt: null,
      lastMessagePreview: "",
    });
    conv = conv.toObject();
  } else if (!conv.assignedTo) {
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { assignedTo: adminId, status: "abierto" } }
    );
    conv.assignedTo = adminId;
    conv.status = "abierto";
  }
  return conv;
}

// =========================================================
// POST /api/messages/conversations/open
// =========================================================
exports.openConversation = async (req, res) => {
  try {
    const me = req.user;
    if (me.role === "admin") {
      const targetUserId = req.body?.withUserId;
      if (!isObjectId(String(targetUserId))) {
        return res.status(400).json({ error: "withUserId requerido" });
      }

      // conversación única por usuario; si no existe la crea con este admin
      let conv = await Conversation.findOne({ user: targetUserId }).lean();
      if (!conv) {
        conv = await Conversation.create({
          user: targetUserId,
          assignedTo: me.id,
          status: "abierto",
        });
        conv = conv.toObject();
      } else if (
        !conv.assignedTo ||
        String(conv.assignedTo) !== String(me.id)
      ) {
        await Conversation.updateOne(
          { _id: conv._id },
          { $set: { assignedTo: me.id, status: "abierto" } }
        );
      }
      return res.json({ conversationId: String(conv._id) });
    }

    // usuario normal
    const conv = await ensureUserConversation(me.id);
    return res.json({ conversationId: String(conv._id) });
  } catch (err) {
    const status = err.status || 500;
    console.error("openConversation error:", err);
    return res
      .status(status)
      .json({ error: err.message || "No se pudo abrir la conversación" });
  }
};

// =========================================================
// GET /api/messages/history/conversation/:conversationId
// ?limit=50&before=<ISO|ms>
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

    const msgs = await Message.find(criteria, null, { sanitizeFilter: false })
      .sort({ createdAt: -1 }) // del más nuevo hacia atrás
      .limit(limit)
      .populate("from", "name _id")
      .populate("to", "name _id")
      .select("+content")
      .lean();

    const result = msgs.reverse().map((m) => {
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
// POST /api/messages
//  - Soporta Idempotency-Key en header para evitar duplicados
// =========================================================
exports.sendMessage = async (req, res) => {
  try {
    const { to, content, order, conversationId } = req.body || {};
    const from = String(req.user.id);

    const text = String(content || "").trim();
    if (!text || text.length > MAX_LEN) {
      return res.status(400).json({ error: "Contenido inválido" });
    }

    // Idempotencia: mismo remitente + misma key -> mismo mensaje
    const idemKeyRaw = req.get("Idempotency-Key");
    const idempotencyKey = (idemKeyRaw || "").trim() || null;

    let finalTo = to;

    if (conversationId) {
      if (!isObjectId(String(conversationId))) {
        return res.status(400).json({ error: "Conversación inválida" });
      }
      const convo = await Conversation.findById(conversationId).lean();
      if (!convo)
        return res.status(404).json({ error: "Conversación no encontrada" });

      const isMember = [String(convo.user), String(convo.assignedTo)].includes(
        from
      );
      if (!isMember) return res.status(403).json({ error: "Acceso denegado" });

      finalTo =
        String(convo.user) === from
          ? String(convo.assignedTo)
          : String(convo.user);
    }

    if (!isObjectId(String(finalTo))) {
      return res.status(400).json({ error: "Destino inválido" });
    }
    if (String(finalTo) === from) {
      return res
        .status(400)
        .json({ error: "No puedes enviarte mensajes a ti mismo" });
    }

    const toUser = await User.findById(finalTo).select("_id role").lean();
    if (!toUser)
      return res.status(404).json({ error: "Destinatario no encontrado" });

    // Si llega Idempotency-Key, intenta fetch del mensaje ya creado
    if (idempotencyKey) {
      const existing = await Message.findOne({ from, idempotencyKey })
        .populate("from", "name email role _id")
        .populate("to", "name email role _id")
        .select("+content")
        .lean();
      if (existing) {
        const response = (() => {
          const c = existing?.contentEnc?.data
            ? decryptText(existing.contentEnc)
            : String(existing?.content || "");
          const { contentEnc, ...rest } = existing;
          return {
            ...rest,
            content: c,
            conversationId: conversationId || existing.conversationId || null,
          };
        })();
        return res.status(200).json(response);
      }
    }

    const payload = {
      from,
      to: finalTo,
      order: order || undefined,
      isRead: false,
      status: "abierto",
      createdAt: new Date(),
      contentEnc: encryptText(text),
      idempotencyKey,
      ...(conversationId ? { conversationId } : {}),
    };

    let doc;
    try {
      doc = await Message.create(payload);
    } catch (err) {
      // Si es violación de índice único, recuperamos el existente
      if (idempotencyKey && err && err.code === 11000) {
        const existing = await Message.findOne({ from, idempotencyKey })
          .populate("from", "name email role _id")
          .populate("to", "name email role _id")
          .select("+content")
          .lean();
        if (existing) {
          const response = (() => {
            const c = existing?.contentEnc?.data
              ? decryptText(existing.contentEnc)
              : String(existing?.content || "");
            const { contentEnc, ...rest } = existing;
            return {
              ...rest,
              content: c,
              conversationId: conversationId || existing.conversationId || null,
            };
          })();
          return res.status(200).json(response);
        }
      }
      throw err;
    }

    if (conversationId) {
      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { lastMessageAt: new Date(), lastMessagePreview: text } }
      );
    }

    const populated = await Message.findById(doc._id)
      .populate("from", "name email role _id")
      .populate("to", "name email role _id")
      .select("+content")
      .lean();

    const response = (() => {
      const { contentEnc, ...rest } = populated || {};
      return { ...rest, content: text, conversationId: conversationId || null };
    })();

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${from}`).emit("newMessage", response);
      io.to(`user:${finalTo}`).emit("newMessage", response);
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

// =========================================================
// GET /api/messages/inbox/admin  (optimizado sin N+1)
// =========================================================
exports.getInboxUsers = async (req, res) => {
  const adminIdStr = String(req.user.id || "");
  try {
    // Autorización de rol y whitelist
    if (!canSeeSupport(adminIdStr)) {
      return res.json([]); // Admin no habilitado para soporte ⇒ lista vacía
    }

    // Valida y castea adminId
    if (!Types.ObjectId.isValid(adminIdStr)) {
      return res.status(403).json({ error: "Admin inválido" });
    }
    const adminId = new Types.ObjectId(adminIdStr);

    // Busca conversaciones asignadas a este admin
    const convos = await Conversation.find({ assignedTo: adminId })
      .populate("user", "name email _id")
      .sort({ lastMessageAt: -1 })
      .lean();

    const filtered = (convos || []).filter((c) => c?.status !== "cerrado");

    // Procesa cada conversación de forma segura (no rompas toda la respuesta si una falla)
    const results = [];
    for (const c of filtered) {
      try {
        const userId = c?.user?._id
          ? new Types.ObjectId(String(c.user._id))
          : null;
        if (!userId) continue;

        // ¿Tiene no leídos?
        const hasUnread = await Message.exists({
          from: userId,
          to: adminId,
          isRead: false,
        });

        // Preview/fecha: usa campos de la conversación si existen, si no busca el último mensaje
        let lastMessagePreview = c.lastMessagePreview || "";
        let lastMessageTime = c.lastMessageAt || null;

        if (!lastMessageTime || !lastMessagePreview) {
          const lastMsg = await Message.findOne(
            {
              $or: [
                { from: userId, to: adminId },
                { from: adminId, to: userId },
              ],
            },
            null,
            { sanitizeFilter: false }
          )
            .sort({ createdAt: -1 })
            .select("+content contentEnc createdAt")
            .lean();

          if (lastMsg) {
            const preview = lastMsg?.contentEnc?.data
              ? decryptText(lastMsg.contentEnc)
              : String(lastMsg?.content || "");
            lastMessagePreview = (preview || "").slice(0, 200);
            lastMessageTime = lastMsg.createdAt;
          }
        }

        results.push({
          _id: c.user._id,
          name: c.user.name || "Usuario",
          email: c.user.email || "",
          lastMessage: lastMessagePreview || "",
          lastMessageTime: lastMessageTime || null,
          unread: !!hasUnread,
          status: c.status || "abierto",
          conversationId: String(c._id),
        });
      } catch (e) {
        // Loggea, pero no rompas toda la respuesta
        console.warn(
          `[inbox/admin] conversación problemática ${c?._id}:`,
          e?.message || e
        );
      }
    }

    return res.json(results);
  } catch (err) {
    console.error("Error en getInboxUsers:", err);
    // No expongas detalles — devuelve vacío para no romper el cliente
    return res.status(200).json([]);
  }
};

// =========================================================
// (LEGACY) GET /api/messages/:withUserId  (añade sanitizeFilter: false)
// =========================================================
exports.getMessageHistory = async (req, res) => {
  const { withUserId } = req.params;
  const userId = String(req.user.id);

  try {
    const msgs = await Message.find(
      {
        $or: [
          { from: userId, to: withUserId },
          { from: withUserId, to: userId },
        ],
      },
      null,
      { sanitizeFilter: false }
    )
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
// GET /api/messages/unread/count
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
// POST /api/messages/read
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

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${myId}`).emit("adminInboxUpdate");
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
// POST /api/messages/conversation/read
// =========================================================
exports.markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.body || {};
    const myId = String(req.user.id);

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

    // ✅ Idempotencia rápida: si no hay nada por leer, salimos sin escribir
    const hasUnread = await Message.exists({
      conversationId,
      to: myId,
      isRead: false,
    }).lean();
    if (!hasUnread) {
      return res.json({ success: true, matched: 0, modified: 0 });
    }

    // Actualiza solo si había no leídos
    const result = await Message.updateMany(
      { conversationId, to: myId, isRead: false },
      { $set: { isRead: true } }
    );

    const now = new Date();
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { [`readPointers.${isUser ? "user" : "admin"}`]: now } }
    );

    const io = req.app.get("io");
    if (io) {
      const otherId = isUser ? String(convo.assignedTo) : String(convo.user);
      // Notifica solo si efectivamente hubo cambios
      if (result.modifiedCount > 0) {
        io.to(`user:${otherId}`).emit("support:readReceipt", {
          conversationId,
          by: myId,
          at: now,
        });
        io.to(`user:${String(convo.assignedTo)}`).emit("adminInboxUpdate", {
          conversationId,
          at: now,
        });
      }
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
// GET /api/messages/conversations/list  (proyección ligera)
// =========================================================
exports.getConversations = async (req, res) => {
  try {
    const uid = String(req.user.id);
    const role = String(req.user.role || "user");

    if (role === "admin") {
      if (!canSeeSupport(uid)) return res.json([]);

      const convos = await Conversation.find(
        { assignedTo: uid },
        { user: 1, status: 1, lastMessageAt: 1 } // proyección ligera
      )
        .populate("user", "name role _id")
        .sort({ lastMessageAt: -1, updatedAt: -1 })
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
    const convos = await Conversation.find(
      { user: uid },
      { assignedTo: 1, status: 1, lastMessageAt: 1 } // proyección ligera
    )
      .populate("assignedTo", "name role _id")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
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
// PATCH /api/messages/status  (sin $ne; añade sanitizeFilter a $or)
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
    const convo = await Conversation.findOne({
      user: userId,
      assignedTo: adminId,
    });

    if (!convo) {
      return res.status(404).json({ error: "Conversación no encontrada" });
    }

    if (convo.status !== status) {
      await Conversation.updateOne({ _id: convo._id }, { $set: { status } });

      await Message.updateMany(
        {
          conversationId: convo._id,
          $or: [
            { from: adminId, to: userId },
            { from: userId, to: adminId },
          ],
        },
        { $set: { status } },
        { sanitizeFilter: false }
      );
    }

    const io = req.app.get("io");
    if (io) {
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

/**
 * Crea mensaje. Si no se envía conversationId:
 *  - Usuario normal: upsert de conversación única por usuario.
 *  - Admin: requiere withUserId para abrir/usar la conversación con ese usuario.
 */
exports.createMessage = async (req, res) => {
  try {
    const me = req.user;
    const { conversationId, content, withUserId } = req.body || {};
    const text = sanitizeText(content, 2000);
    if (!text) return res.status(400).json({ error: "Mensaje vacío" });

    let conv;

    if (conversationId) {
      if (!isObjectId(String(conversationId))) {
        return res.status(400).json({ error: "Conversación inválida" });
      }
      conv = await Conversation.findById(conversationId).lean();
      if (!conv)
        return res.status(404).json({ error: "Conversación no encontrada" });
      const isParticipant =
        String(conv.user) === String(me.id) ||
        String(conv.assignedTo) === String(me.id);
      if (!isParticipant)
        return res.status(403).json({ error: "No autorizado" });
      // Si le falta assignedTo (DB antigua), arréglalo
      if (!conv.assignedTo) {
        const fixAdmin = me.role === "admin" ? me.id : await pickSupportAgent();
        await Conversation.updateOne(
          { _id: conv._id },
          { $set: { assignedTo: fixAdmin } }
        );
        conv.assignedTo = fixAdmin;
      }
    } else {
      // no llega conversationId -> asegúrate de que hay una
      if (me.role === "admin") {
        // admin necesita withUserId
        if (!isObjectId(String(withUserId))) {
          return res.status(400).json({ error: "Falta withUserId para admin" });
        }
        let tmp = await Conversation.findOne({ user: withUserId }).lean();
        if (!tmp) {
          tmp = await Conversation.create({
            user: withUserId,
            assignedTo: me.id,
            status: "abierto",
          });
          tmp = tmp.toObject();
        } else if (!tmp.assignedTo) {
          await Conversation.updateOne(
            { _id: tmp._id },
            { $set: { assignedTo: me.id } }
          );
          tmp.assignedTo = me.id;
        }
        conv = tmp;
      } else {
        conv = await ensureUserConversation(me.id);
      }
    }

    // calcula el destinatario
    const to =
      String(conv.user) === String(me.id)
        ? String(conv.assignedTo)
        : String(conv.user);

    // crea el mensaje
    const msg = await Message.create({
      conversationId: conv._id,
      from: me.id,
      to,
      content: text,
      isRead: false,
      status: "abierto",
    });

    // marca preview/fecha
    await Conversation.updateOne(
      { _id: conv._id },
      {
        $set: {
          lastMessageAt: new Date(),
          lastMessagePreview: text,
          status: "abierto",
        },
      }
    );

    // notificaciones socket (opcional)
    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          _id: msg._id,
          conversationId: conv._id,
          from: { _id: me.id },
          to: { _id: to },
          content: msg.content,
          createdAt: msg.createdAt,
        };
        io.to(`user:${String(conv.user)}`).emit("newMessage", payload);
        io.to(`user:${String(conv.assignedTo)}`).emit("newMessage", payload);
        io.to("role:admin").emit("adminInboxUpdate", {
          conversationId: conv._id,
        });
      }
    } catch {}

    return res.status(201).json(msg);
  } catch (err) {
    const status = err.status || 500;
    console.error("createMessage error:", err);
    return res
      .status(status)
      .json({ error: err.message || "No se pudo enviar el mensaje" });
  }
};
