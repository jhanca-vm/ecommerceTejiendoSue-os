import { useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { SupportContext } from "../contexts/SupportContext";
import { AuthContext } from "../contexts/AuthContext";
import SupportChatBlock from "../blocks/SupportChatBlock";

const SupportChatPage = () => {
  const { user } = useContext(AuthContext);
  const {
    messages,
    fetchMessages,
    sendMessage,
    markMessagesAsRead,
    fetchUnreadMessagesCount,
  } = useContext(SupportContext);

  const { withUserId } = useParams();
  const navigate = useNavigate();

  const getTargetId = () => {
    if (!user) return null;
    // ID del admin 
    if (user.role === "user") return "687c285756076cf6e9836fce"; 
    if (user.role === "admin") return withUserId || null;
    return null;
  };

  useEffect(() => {
    if (!user) return;

    const targetId = getTargetId();
    if (!targetId) {
      if (user.role === "admin") navigate("/admin/inbox");
      return;
    }

    const loadMessages = async () => {
      await fetchMessages(targetId);
      await markMessagesAsRead(targetId);
      await fetchUnreadMessagesCount();
    };

    loadMessages();

    return () => {
      // limpieza automática
    };
  }, [user, withUserId]);

  const handleSend = (text) => {
    const to = getTargetId();
    if (to) sendMessage(to, text);
  };

  return (
    <div>
      <SupportChatBlock
        messages={messages}
        onSendMessage={handleSend}
        user={user}
      />
    </div>
  );
};

export default SupportChatPage;
