// src/pages/SupportChatPage.jsx
import { useEffect, useContext, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { SupportContext } from "../contexts/SupportContext";
import SupportChatBlock from "../blocks/SupportChatBlock";

export default function SupportChatPage() {
  const { user } = useContext(AuthContext);
  const {
    openConversation,
    fetchHistoryByConversation,
    markConversationAsRead,
    messagesByConv,
  } = useContext(SupportContext);

  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user || user.role !== "user") return;
      const cid = await openConversation();
      if (!mounted) return;
      if (!cid) {
        setError("Soporte no disponible en este momento.");
        return;
      }
      setConversationId(cid);
      await fetchHistoryByConversation(cid, { limit: 50 });
      await markConversationAsRead(cid);
    })();
    return () => {
      mounted = false;
    };
  }, [
    user,
    openConversation,
    fetchHistoryByConversation,
    markConversationAsRead,
  ]);

  if (!user) return null;
  if (user.role !== "user")
    return <div style={{ padding: 24 }}>Esta vista es para usuarios.</div>;
  if (error) return <div style={{ padding: 24 }}>{error}</div>;

  const messages = messagesByConv[conversationId] || [];

  return (
    <div>
      <SupportChatBlock conversationId={conversationId} messages={messages} />
    </div>
  );
}
