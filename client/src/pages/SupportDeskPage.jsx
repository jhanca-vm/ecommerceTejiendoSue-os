// src/pages/SupportDeskPage.jsx
import { useEffect, useMemo, useState, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SupportContext } from "../contexts/SupportContext";
import { AuthContext } from "../contexts/AuthContext";
import SupportChatBlock from "../blocks/SupportChatBlock";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default function SupportDeskPage() {
  const { user } = useContext(AuthContext);
  const {
    conversations,
    loadingList,
    activeConversationId,
    setActiveConversationId,
    messagesByConv,
    fetchHistoryByConversation,
    markConversationAsRead,
  } = useContext(SupportContext);

  const query = useQuery();
  const navigate = useNavigate();
  const [loadingConv, setLoadingConv] = useState(false);

  // Sincroniza ?c= con el estado local
  useEffect(() => {
    const cid = query.get("c");
    if (cid && cid !== activeConversationId) {
      setActiveConversationId(cid);
    }
  }, [query, activeConversationId, setActiveConversationId]);

  // Carga inicial del historial de la conversación activa (con guardias del contexto)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!activeConversationId) return;
      setLoadingConv(true);
      try {
        await fetchHistoryByConversation(activeConversationId, { limit: 50 });
        if (!mounted) return;
        await markConversationAsRead(activeConversationId);
      } finally {
        if (mounted) setLoadingConv(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeConversationId, fetchHistoryByConversation, markConversationAsRead]);

  const onSelectConversation = (cid) => {
    setActiveConversationId(cid);
    navigate(`/admin/inbox?c=${cid}`);
  };

  const messages = messagesByConv[activeConversationId] || [];

  return (
    <div
      className="support-desk"
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: "12px",
        minHeight: "60vh",
      }}
    >
      {/* Sidebar */}
      <aside
        className="support-sidebar"
        style={{ borderRight: "1px solid #e4e4e4", paddingRight: 12 }}
      >
        <h3 style={{ margin: "8px 0 12px" }}>Soporte</h3>

        {loadingList ? (
          <p>Cargando conversaciones…</p>
        ) : conversations.length === 0 ? (
          <p>No hay conversaciones.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {conversations.map((c) => {
              const isActive = c.conversationId === activeConversationId;
              const unread = !!c.unread;
              return (
                <li key={c.conversationId} style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => onSelectConversation(c.conversationId)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: isActive ? "2px solid #222" : "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div style={{ fontWeight: 700, flex: 1 }}>
                        {c.name || (c.role === "admin" ? "Soporte" : "Usuario")}
                      </div>
                      {user?.role === "admin" && c.lastMessageTime && (
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                          {fmtTime(c.lastMessageTime)}
                        </div>
                      )}
                      {unread && (
                        <span
                          aria-label="mensajes no leídos"
                          title="No leído"
                          style={{
                            display: "inline-block",
                            minWidth: 10,
                            height: 10,
                            borderRadius: 999,
                            background: "#e11",
                          }}
                        />
                      )}
                    </div>
                    {user?.role === "admin" && c.lastMessage && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          opacity: 0.8,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.lastMessage}
                      </div>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      {c.status === "cerrado"
                        ? "Cerrado"
                        : c.status === "en_espera"
                        ? "En espera"
                        : "Abierto"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Panel de chat */}
      <section className="support-panel" style={{ paddingLeft: 6 }}>
        {!activeConversationId ? (
          <div style={{ padding: 24 }}>Selecciona una conversación.</div>
        ) : loadingConv ? (
          <div style={{ padding: 24 }}>Cargando mensajes…</div>
        ) : (
          <SupportChatBlock
            conversationId={activeConversationId}
            messages={messages}
          />
        )}
      </section>
    </div>
  );
}

