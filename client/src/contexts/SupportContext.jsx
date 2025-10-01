// src/contexts/SupportContext
import { createContext, useContext, useEffect, useState } from "react";

import apiUrl from "../api/apiClient";

import { AuthContext } from "./AuthContext";
import { useToast } from "./ToastContext";
import { socket } from "../socket";

// eslint-disable-next-line react-refresh/only-export-components
export const SupportContext = createContext();

export const SupportProvider = ({ children }) => {
  const { token, user } = useContext(AuthContext);
  const { showToast } = useToast();

  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  // 🔌 Conectar al socket una vez autenticado
  useEffect(() => {
    if (token && user) {
      socket.auth = { token };
      socket.connect();

      socket.on("connect", () => {});

      socket.on("newMessage", (msg) => {
        const currentChatId =
          user?.role === "user"
            ? "687c285756076cf6e9836fce"
            : window.location.pathname.split("/support/")[1]; // para admin

        // Mostrar solo si el mensaje pertenece a la conversación actual
        if (msg.from._id === currentChatId || msg.to._id === currentChatId) {
          setMessages((prev) => [...prev, msg]);
        }

        // Mostrar toast solo si el mensaje fue recibido (no enviado por el mismo usuario)
        if (msg.from._id !== user.id) {
          showToast("Nuevo mensaje recibido", "info");
        }

        fetchUnreadMessagesCount();
      });

      return () => {
        socket.off("newMessage");
        socket.disconnect();
      };
    }
  }, [token, user]);

  // Obtener historial de mensajes
  const fetchMessages = async (withUserId) => {
    if (!token || !withUserId) return;
    try {
      setLoading(true);
      const res = await apiUrl.get(
        `messages/${withUserId}`,
        authHeaders
      );
      setMessages(res.data);
    } catch (err) {
      console.error("Error al cargar mensajes", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Enviar mensaje sin agregarlo manualmente (evita duplicados)
  const sendMessage = async (to, content) => {
    if (!token || !to || !content.trim()) return;
    try {
      await apiUrl.post(
        `messages`,
        { to, content: content.trim() },
        authHeaders
      );
      // No se hace setMessages ni showToast aquí
    } catch (err) {
      console.error("Error al enviar mensaje", err);
    }
  };

  const fetchUnreadMessagesCount = async () => {
    if (!token) return;
    try {
      const res = await apiUrl.get(
        "messages/unread/count",
        authHeaders
      );
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error("Error al obtener conteo de mensajes no leídos", err);
    }
  };

  const markMessagesAsRead = async (fromUserId) => {
    if (!token || !fromUserId) return;
    try {
      await apiUrl.post(
        "messages/read",
        { from: fromUserId },
        authHeaders
      );
      await fetchUnreadMessagesCount();
    } catch (err) {
      console.error("Error al marcar mensajes como leídos", err);
    }
  };

  return (
    <SupportContext.Provider
      value={{
        messages,
        fetchMessages,
        sendMessage,
        unreadCount,
        fetchUnreadMessagesCount,
        markMessagesAsRead,
        loading,
      }}
    >
      {children}
    </SupportContext.Provider>
  );
};
