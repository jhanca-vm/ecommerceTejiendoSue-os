import { useEffect, useState, useRef } from "react";
import apiUrl from "../../../api/apiClient";
import { Link } from "react-router-dom";
import { socket } from "../../../socket";

// Opcional: si luego quieres tiempo real, podrás importar socket y escuchar "admin:alert"


const mapType = (t) => {
  if (t === "OUT_OF_STOCK_VARIANT") return "Variante sin stock";
  if (t === "LOW_STOCK_VARIANT") return "Variante stock bajo";
  if (t === "OUT_OF_STOCK") return "Producto sin stock";
  if (t === "LOW_STOCK") return "Producto stock bajo";
  if (t === "ORDER_STALE_STATUS") return "Pedido estancado";
  return t;
};

const AdminAlertsPage = () => {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState("0");
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (seen === "0" || seen === "1") params.seen = seen;
      const { data } = await apiUrl.get("/admin/alerts", { params });
      setItems(data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); 
  }, [seen]);

  // (Opcional) Esqueleto para tiempo real por Socket.IO:
   useEffect(() => {
  //   // Conectar una sola vez
     socket.connect();
     const onAlert = (alert) => {
  //     // Si estás filtrando "no vistas", inserta solo si alert.seen === false
       setItems((prev) => [alert, ...prev]);
     };
     socket.on("admin:alert", onAlert);
     unsubRef.current = () => {
       socket.off("admin:alert", onAlert);
       socket.disconnect();
     };
     return () => unsubRef.current?.();
   }, []);

  const markSeen = async (id, value = true) => {
    await apiUrl.patch(`/admin/alerts/${id}/seen`, { seen: value });
    setItems((arr) => arr.filter((a) => a._id !== id));
  };

  const markAllSeen = async () => {
    await apiUrl.patch("/admin/alerts/seen-all", { seen: true });
    load();
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div style={{ padding: 20 }}>
      <h2>Alertas</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          margin: "12px 0",
        }}
      >
        <label>
          Filtro:{" "}
          <select value={seen} onChange={(e) => setSeen(e.target.value)}>
            <option value="0">No vistas</option>
            <option value="1">Vistas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <button onClick={load}>Actualizar</button>
        {seen !== "1" && (
          <button onClick={markAllSeen}>Marcar todas como vistas</button>
        )}
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : items.length === 0 ? (
        <p>No hay alertas.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Tipo</th>
              <th style={{ textAlign: "left" }}>Mensaje</th>
              <th style={{ textAlign: "left" }}>Asociado</th>
              <th style={{ textAlign: "left" }}>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((al) => {
              const isOrder = al.type === "ORDER_STALE_STATUS";
              return (
                <tr key={al._id}>
                  <td>{mapType(al.type)}</td>
                  <td>{al.message}</td>
                  <td>
                    {isOrder ? (
                      <>
                        Pedido:&nbsp;
                        {al.order ? (
                          <Link to={`/admin/orders/${al.order}`}>
                            #{String(al.order).slice(-8).toUpperCase()}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {al.orderStatus ? (
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
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
                        {al.variant?.size?.label || al.variant?.color?.name ? (
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            {al.variant?.size?.label
                              ? ` · Talla: ${al.variant.size.label}`
                              : ""}
                            {al.variant?.color?.name
                              ? ` · Color: ${al.variant.color.name}`
                              : ""}
                          </div>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td>{fmtDate(al.createdAt)}</td>
                  <td>
                    {!al.seen ? (
                      <button onClick={() => markSeen(al._id, true)}>
                        Marcar vista
                      </button>
                    ) : (
                      <button onClick={() => markSeen(al._id, false)}>
                        Marcar no vista
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminAlertsPage;
