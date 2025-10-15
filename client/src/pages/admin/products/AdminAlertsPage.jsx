// src/pages/admin/alerts/AdminAlertsPage.jsx
import { useEffect, useState, useRef } from "react";
import api from "../../../api/apiClient";
import { Link } from "react-router-dom";
import { useAdminAlerts } from "../../../contexts/AdminAlertsContext";

const mapType = (t) => {
  if (t === "OUT_OF_STOCK_VARIANT") return "Variante sin stock";
  if (t === "LOW_STOCK_VARIANT") return "Variante stock bajo";
  if (t === "OUT_OF_STOCK") return "Producto sin stock";
  if (t === "LOW_STOCK") return "Producto stock bajo";
  if (t === "ORDER_STALE_STATUS") return "Pedido estancado";
  if (t === "ORDER_CREATED") return "Pedido creado";
  if (t === "ORDER_STATUS_CHANGED") return "Estado de pedido";
  return t;
};

const AdminAlertsPage = () => {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState("0"); // "0" no vistas, "1" vistas, "all"
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  const { socket, syncUnread } = useAdminAlerts();

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (seen === "0" || seen === "1") params.seen = seen;
      const { data } = await api.get("/admin/alerts", { params });
      setItems(data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  useEffect(() => {
    if (!socket) return;
    const onAlert = (alert) => {
      setItems((prev) => [alert, ...prev]);
      syncUnread();
    };
    socket.on("admin:alert", onAlert);
    unsubRef.current = () => socket.off("admin:alert", onAlert);
    return () => unsubRef.current?.();
  }, [socket, syncUnread]);

  const markSeen = async (id, value = true) => {
    await api.patch(`/admin/alerts/${id}/seen`, { seen: value });
    setItems((arr) => arr.filter((a) => a._id !== id));
    syncUnread();
  };

  const markAllSeen = async () => {
    await api.patch("/admin/alerts/seen-all", { seen: true });
    await load();
    syncUnread();
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div className="ao">
      <div className="alerts__head">
        <h2 className="alerts__title">Alertas</h2>
      </div>

      <div className="card alerts-filters">
        <label className="alerts-filters__group">
          <span className="alerts-filters__label">Filtro</span>
          <select
            className="select"
            value={seen}
            onChange={(e) => setSeen(e.target.value)}
          >
            <option value="0">No vistas</option>
            <option value="1">Vistas</option>
            <option value="all">Todas</option>
          </select>
        </label>

        <div className="alerts-filters__actions">
          <button className="btn btn--ghost" onClick={load}>
            Actualizar
          </button>
          {seen !== "1" && (
            <button className="btn btn--primary" onClick={markAllSeen}>
              Marcar todas como vistas
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="alerts-loading sk"></div>
      ) : items.length === 0 ? (
        <div className="card alerts-empty">
          <div className="alerts-empty__icon" />
          <p className="alerts-empty__text">No hay alertas.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table alerts-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Mensaje</th>
                <th>Asociado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((al) => {
                const isOrder =
                  al.type === "ORDER_STALE_STATUS" ||
                  al.type === "ORDER_CREATED" ||
                  al.type === "ORDER_STATUS_CHANGED";

                const orderId =
                  typeof al.order === "string" ? al.order : al.order?._id || "";

                const orderLast8 = orderId
                  ? String(orderId).slice(-8).toUpperCase()
                  : "—";

                return (
                  <tr key={al._id} className={!al.seen ? "is-unseen" : ""}>
                    <td className="alerts-col-type">{mapType(al.type)}</td>
                    <td className="alerts-col-msg">{al.message}</td>
                    <td className="alerts-col-assoc">
                      {isOrder ? (
                        <>
                          <span className="assoc-label">Pedido: </span>
                          {orderId ? (
                            <Link to={`/admin/orders/${orderId}`}>
                              #{orderLast8}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {al.orderStatus ? (
                            <div className="assoc-meta">
                              Estado: {al.orderStatus}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {al.product?._id ? (
                            <Link to={`/admin/products/edit/${al.product._id}`}>
                              {al.product?.name || al.product?._id}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {al.variant?.size?.label ||
                          al.variant?.color?.name ? (
                            <div className="assoc-meta">
                              {al.variant?.size?.label
                                ? `· Talla: ${al.variant.size.label} `
                                : ""}
                              {al.variant?.color?.name
                                ? `· Color: ${al.variant.color.name}`
                                : ""}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="alerts-col-date">{fmtDate(al.createdAt)}</td>
                    <td className="alerts-col-actions">
                      {!al.seen ? (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => markSeen(al._id, true)}
                        >
                          Marcar vista
                        </button>
                      ) : (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => markSeen(al._id, false)}
                        >
                          Marcar no vista
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAlertsPage;
