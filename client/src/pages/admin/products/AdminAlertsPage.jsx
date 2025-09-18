import { useEffect, useState } from "react";
import apiUrl from "../../../api/apiClient";
import { Link } from "react-router-dom";

export default function AdminAlertsPage() {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState("0"); 
  const [loading, setLoading] = useState(true);

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
    load(); /* eslint-disable-next-line */
  }, [seen]);

  const markSeen = async (id, value = true) => {
    await apiUrl.patch(`/admin/alerts/${id}/seen`, { seen: value });
    setItems((arr) => arr.filter((a) => a._id !== id));
  };

  const markAllSeen = async () => {
    await apiUrl.patch("/admin/alerts/seen-all", { seen: true });
    load();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Alertas de inventario</h2>

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
              <th style={{ textAlign: "left" }}>Producto / Variante</th>
              <th style={{ textAlign: "left" }}>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((al) => (
              <tr key={al._id}>
                <td>
                  {al.type === "OUT_OF_STOCK_VARIANT"
                    ? "Variante sin stock"
                    : al.type === "LOW_STOCK_VARIANT"
                    ? "Variante stock bajo"
                    : al.type}
                </td>
                <td>{al.message}</td>
                <td>
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
                </td>
                <td>
                  {al.createdAt ? new Date(al.createdAt).toLocaleString() : "—"}
                </td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
