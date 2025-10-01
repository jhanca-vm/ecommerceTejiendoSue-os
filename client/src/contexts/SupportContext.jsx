// src/contexts/SupportContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import api from "../api/apiClient";
import { socket } from "../socket";
import { AuthContext } from "./AuthContext";

// === CONTEXTO: crea y exporta el contexto ===
export const SupportContext = createContext(null);

export function SupportProvider({ children }) {
  const { token, user } = useContext(AuthContext);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [loadingList, setLoadingList] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ====== GUARDAS / COOLDOWNS ======
  const readTimers = useRef(new Map()); // convId -> timeout
  const readInFlight = useRef(new Set()); // convIds con POST /read
  const globalCooldownUntil = useRef(0); // para inbox/unread
  const COOLDOWN_MS = 1200;

  const inFlightHistory = useRef(new Map()); // convId -> Promise
  const lastFetchedAt = useRef(new Map()); // convId -> epoch (ms)
  const HISTORY_TTL_MS = 30_000;

  const openCache = useRef(new Map()); // key -> {at, id, p}
  const OPEN_TTL_MS = 60_000;

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // ---- util de orden + dedupe por _id
  const sortByTime = (arr) =>
    [...arr].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const uniqById = (arr) => {
    const seen = new Set();
    const out = [];
    for (const m of arr) {
      const id = String(m._id || "");
      if (!id) continue;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(m);
      }
    }
    return out;
  };

  const upsertMessages = (convId, newMsgs) => {
    if (!convId || !Array.isArray(newMsgs) || !newMsgs.length) return;
    setMessagesByConv((prev) => {
      const curr = prev[convId] || [];
      const merged = uniqById([...curr, ...newMsgs]);
      return { ...prev, [convId]: sortByTime(merged) };
    });
  };

  // ========== API ==========
  const openConversation = async (withUserId = null) => {
    const key = withUserId ? `admin:${withUserId}` : "self";
    const now = Date.now();

    const cached = openCache.current.get(key);
    if (cached && now - cached.at < OPEN_TTL_MS) return cached.id;
    if (cached?.p) return cached.p;

    const p = (async () => {
      try {
        const body = user?.role === "admin" ? { withUserId } : {};
        const { data } = await api.post("messages/conversations/open", body, {
          headers: authHeader,
        });
        const id = data?.conversationId || null;
        openCache.current.set(key, { at: Date.now(), id });
        return id;
      } catch (e) {
        console.error(
          "openConversation failed:",
          e?.response?.data || e.message
        );
        openCache.current.delete(key);
        return null;
      }
    })();

    openCache.current.set(key, { at: now, id: null, p });
    return p;
  };

  const fetchConversations = async () => {
    const now = Date.now();
    if (now < globalCooldownUntil.current) return;
    globalCooldownUntil.current = now + COOLDOWN_MS;

    setLoadingList(true);
    try {
      const endpoint =
        user?.role === "admin"
          ? "messages/inbox/admin"
          : "messages/conversations/list";
      const { data } = await api.get(endpoint, { headers: authHeader });
      setConversations(Array.isArray(data) ? data : []);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchHistoryByConversation = async (
    conversationId,
    { limit = 50, before } = {}
  ) => {
    const cid = String(conversationId || "");
    if (!cid) return [];

    const now = Date.now();
    const last = lastFetchedAt.current.get(cid) || 0;
    const hasBefore = !!before;

    if (!hasBefore && now - last < HISTORY_TTL_MS) {
      return messagesByConv[cid] || [];
    }

    const running = inFlightHistory.current.get(cid);
    if (running && !hasBefore) {
      await running;
      return messagesByConv[cid] || [];
    }

    const job = (async () => {
      try {
        const url = new URL(
          `${api.defaults.baseURL}/messages/history/conversation/${cid}`
        );
        url.searchParams.set("limit", String(limit));
        if (before) {
          url.searchParams.set(
            "before",
            before instanceof Date ? before.toISOString() : String(before)
          );
        }
        const path = url.toString().replace(api.defaults.baseURL + "/", "");
        const { data } = await api.get(path, { headers: authHeader });
        const msgs = data?.messages || [];
        upsertMessages(cid, msgs);
        if (!hasBefore) lastFetchedAt.current.set(cid, Date.now());
        return msgs;
      } finally {
        if (!hasBefore) inFlightHistory.current.delete(cid);
      }
    })();

    if (!hasBefore) inFlightHistory.current.set(cid, job);
    return job;
  };

  const sendMessage = async (conversationId, text, extra = {}) => {
    const cid = String(conversationId || "");
    if (!cid || !text) return;

    // Optimista
    const tempId = `temp:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      _id: tempId,
      conversationId: cid,
      from: { _id: user.id, name: user.name },
      to: {},
      content: text,
      createdAt: new Date().toISOString(),
      __optimistic: true,
    };
    upsertMessages(cid, [optimistic]);

    const idemKey = `${cid}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;

    try {
      const { data } = await api.post(
        "messages",
        { conversationId: cid, content: text, ...extra },
        { headers: { ...authHeader, "Idempotency-Key": idemKey } }
      );

      setMessagesByConv((prev) => {
        const current = prev[cid] || [];
        const cleaned = current.filter(
          (m) =>
            String(m._id) !== String(tempId) &&
            String(m._id) !== String(data._id)
        );
        const next = uniqById([...cleaned, data]);
        return { ...prev, [cid]: sortByTime(next) };
      });

      lastFetchedAt.current.set(cid, Date.now());
    } catch (e) {
      setMessagesByConv((prev) => {
        const current = prev[cid] || [];
        const cleaned = current.filter((m) => String(m._id) !== String(tempId));
        return { ...prev, [cid]: cleaned };
      });
      throw e;
    }
  };

  const _markConversationAsReadRaw = async (conversationId) => {
    const cid = String(conversationId || "");
    if (!cid || readInFlight.current.has(cid)) return;

    const list = messagesByConv[cid] || [];
    const hasUnreadForMe = list.some(
      (m) => String(m.to?._id) === String(user?.id) && !m.isRead
    );
    if (!hasUnreadForMe) return;

    readInFlight.current.add(cid);
    try {
      await api.post(
        "messages/conversation/read",
        { conversationId: cid },
        { headers: authHeader }
      );
      setMessagesByConv((prev) => {
        const next = (prev[cid] || []).map((m) =>
          String(m.to?._id) === String(user?.id) ? { ...m, isRead: true } : m
        );
        return { ...prev, [cid]: next };
      });
    } finally {
      readInFlight.current.delete(cid);
    }
  };

  const markConversationAsRead = (conversationId, delayMs = 1000) => {
    const cid = String(conversationId || "");
    if (!cid) return;
    const t0 = readTimers.current.get(cid);
    if (t0) clearTimeout(t0);
    const t = setTimeout(() => {
      _markConversationAsReadRaw(cid);
      readTimers.current.delete(cid);
    }, delayMs);
    readTimers.current.set(cid, t);
  };

  const fetchUnreadMessagesCount = async () => {
    const now = Date.now();
    if (now < globalCooldownUntil.current) return;
    globalCooldownUntil.current = now + COOLDOWN_MS;

    try {
      const { data } = await api.get("messages/unread/count", {
        headers: authHeader,
      });
      setUnreadCount(Number(data?.count || 0));
    } catch {
      // noop
    }
  };

  // ===== Socket listeners =====
  useEffect(() => {
    if (!token || !user) return;

    const onNewMessage = (msg) => {
      const convId = String(msg?.conversationId || "");
      if (!convId) return;

      upsertMessages(convId, [msg]);

      if (convId === String(activeConversationId)) {
        if (String(msg.to?._id) === String(user.id)) {
          markConversationAsRead(convId, 900);
        }
      }

      fetchUnreadMessagesCount();
      lastFetchedAt.current.set(convId, 0); // invalida TTL sólo de esa conversación
    };

    const onInboxUpdate = () => {
      fetchConversations();
      fetchUnreadMessagesCount();
    };

    socket.on("newMessage", onNewMessage);
    socket.on("adminInboxUpdate", onInboxUpdate);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("adminInboxUpdate", onInboxUpdate);
    };
  }, [token, user, activeConversationId]);

  // Init
  useEffect(() => {
    if (!token || !user) return;
    fetchConversations();
    fetchUnreadMessagesCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  const value = useMemo(
    () => ({
      conversations,
      loadingList,
      activeConversationId,
      setActiveConversationId,
      messagesByConv,
      setMessagesByConv,
      openConversation,
      fetchConversations,
      fetchHistoryByConversation,
      sendMessage,
      markConversationAsRead,
      fetchUnreadMessagesCount,
      unreadCount,
    }),
    [
      conversations,
      loadingList,
      activeConversationId,
      messagesByConv,
      unreadCount,
    ]
  );

  return (
    <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
  );
}

// === HOOK correcto: usa el CONTEXTO, no el provider ===
export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx)
    throw new Error("useSupport debe usarse dentro de <SupportProvider>");
  return ctx;
}
