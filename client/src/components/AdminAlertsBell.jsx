import { useEffect, useRef, useState, useContext } from "react";
import apiUrl from "../api/apiClient";
import { AuthContext } from "../contexts/AuthContext";
import { getCsrfToken } from "../api/csrfStore";

export default function AdminAlertsBell() {
  const { user, token } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const intervalRef = useRef(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const { data } = await apiUrl.get("/admin/alerts", {
        params: { limit: 10, seen: 0 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(Number(data?.unread || 0));
    } catch (e) {
      console.warn("alerts error", e?.response?.status, e?.response?.data || e);
    } finally {
      setLoading(false);
    }
  };

  const markAllSeen = async () => {
    try {
      await apiUrl.patch(
        "/admin/alerts/seen-all",
        { seen: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-CSRF-Token": getCsrfToken?.() || "",
          },
        }
      );
      setUnread(0);
      setItems([]);
    } catch (e) {
      console.warn("seen-all error", e?.response?.status, e?.response?.data || e);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAlerts();
    intervalRef.current = setInterval(loadAlerts, 30000); // 30s
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token]);

  // Cerrar dropdown al dar click fuera
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="alerts-bell" ref={ref}>
      <button
        type="button"
        className={`icon-btn ${open ? "active" : ""}`}
        onClick={() => {
          setOpen((s) => !s);
          if (!open) loadAlerts();
        }}
        title="Alertas de stock"
        aria-label="Alertas de stock"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z" />
        </svg>
        {unread > 0 && <span className="notification-badge">{unread}</span>}
      </button>

      {open && (
        <div className="alerts-dropdown">
          <div className="alerts-head">
            <strong>Alertas</strong>
            <button
              type="button"
              className="small"
              onClick={markAllSeen}
              disabled={loading || unread === 0}
            >
              Marcar todas como vistas
            </button>
          </div>

          {loading ? (
            <div className="alerts-empty">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="alerts-empty">Sin alertas nuevas</div>
          ) : (
            <ul className="alerts-list">
              {items.map((a) => (
                <li key={a._id} className={`al al--${a.type}`}>
                  <div className="al-title">
                    {a.type === "OUT_OF_STOCK" ? "Sin stock" : "Stock bajo"}
                  </div>
                  <div className="al-msg">{a.message}</div>
                  <div className="al-meta">
                    <span>{a.product?.name || "Producto"}</span>
                    <time>
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleString()
                        : ""}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
