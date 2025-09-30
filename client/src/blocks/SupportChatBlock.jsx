// src/blocks/SupportChatBlock.jsx
import { useContext, useEffect, useRef, useState } from "react";
import { SupportContext } from "../contexts/SupportContext";
import { AuthContext } from "../contexts/AuthContext";

export default function SupportChatBlock({ conversationId, messages }) {
  const { user } = useContext(AuthContext);
  const { sendMessage } = useContext(SupportContext);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const canType = Boolean(conversationId);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto scroll al recibir mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Foco al cambiar de conversación
  useEffect(() => {
    if (canType) inputRef.current?.focus();
  }, [canType, conversationId]);

  const handleSend = async () => {
    const t = text.trim();
    if (!canType || !t || sending) return;
    setSending(true);
    try {
      await sendMessage(conversationId, t);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fmt = (iso) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="chat-container">
      <div className="chat-header">Soporte al cliente</div>

      <div className="chat-messages">
        {messages.map((m) => (
          <div
            key={`${m._id}:${m.createdAt}`} // clave más estable ante merges
            className={`chat-message ${
              String(m.from?._id) === String(user.id) ? "sent" : "received"
            }`}
          >
            <div className="chat-meta">
              <span className="chat-sender">{m.from?.name || "—"}</span>
              <span className="chat-time">{fmt(m.createdAt)}</span>
            </div>
            <p className="chat-text">{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        {!canType && <div className="chat-hint">Conectando con soporte…</div>}
        <textarea
          ref={inputRef}
          placeholder={
            canType
              ? "Escribe tu mensaje… (Enter para enviar, Shift+Enter para salto de línea)"
              : "Conectando con soporte…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!canType || sending}
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={!canType || sending || text.trim().length < 1}
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
