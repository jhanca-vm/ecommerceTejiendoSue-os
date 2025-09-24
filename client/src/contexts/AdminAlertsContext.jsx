import { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../api/apiClient";
import { socket, connectSocketWithToken, disconnectSocket } from "../socket";
import { AuthContext } from "./AuthContext";

const AdminAlertsContext = createContext({
  unread: 0,
  syncUnread: () => {},
  setUnread: () => {},
  socket: null,
});

export const useAdminAlerts = () => useContext(AdminAlertsContext);

export const AdminAlertsProvider = ({ children }) => {
  const { user, token: authTokenFromCtx } = useContext(AuthContext) || {};
  const isAdmin = user?.role === "admin";
  const [unread, setUnread] = useState(0);
  const mounted = useRef(false);

  const syncUnread = async () => {
    try {
      // pedimos 1 item para no cargar, pero el backend devuelve { unread }
      const { data } = await api.get("/admin/alerts", { params: { limit: 1 } });
      setUnread(Number(data?.unread || 0));
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setUnread(0);
      if (socket.connected) disconnectSocket();
      return;
    }

    const token =
      authTokenFromCtx ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "";

    connectSocketWithToken(token); // asegura conexión con auth
    syncUnread();

    const onAlert = () => {
      // cada alerta nueva suma 1 (el backend siempre envía seen=false)
      setUnread((u) => u + 1);
    };

    socket.on("admin:alert", onAlert);
    return () => {
      socket.off("admin:alert", onAlert);
      // No desconectamos aquí porque otros componentes podrían estar usando el socket;
      // el disconnect global lo hacemos cuando el usuario deja de ser admin o cierra sesión.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authTokenFromCtx]);

  return (
    <AdminAlertsContext.Provider value={{ unread, syncUnread, setUnread, socket }}>
      {children}
    </AdminAlertsContext.Provider>
  );
};
