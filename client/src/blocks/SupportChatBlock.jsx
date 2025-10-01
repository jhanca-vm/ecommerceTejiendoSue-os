// src/blocks/SupportChatBlock
import { useState, useEffect, useRef } from "react";

const SupportChatBlock = ({ messages, onSendMessage, user }) => {
  
  const [newMessage, setNewMessage] = useState("");
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  const handleSend = () => {
    if (newMessage.trim().length < 1) return;

    onSendMessage(newMessage.trim());
    setNewMessage("");
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">Soporte al cliente</div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${
              msg.from._id === user.id ? "sent" : "received"
            }`}
          >
            <div className="chat-meta">
              <span className="chat-sender">{msg.from.name}</span>
              <span className="chat-time">{formatTime(msg.createdAt)}</span>
            </div>
            <p className="chat-text">{msg.content}</p>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <div className="chat-input">
        <input
          type="text"
          placeholder="Escribe tu mensaje..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          ref={inputRef}
        />
        <button onClick={handleSend} disabled={newMessage.trim().length < 1}>
          Enviar
        </button>
      </div>
    </div>
  );
};

export default SupportChatBlock;
