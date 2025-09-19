import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ConfirmModal from "../ConfirmModalBlock";
import { formatCOP } from "../../utils/currency";

const OrderCardBlock = ({ order, onStatusChange, onCancel }) => {
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmMode, setConfirmMode] = useState(null);
  const [pendingStatus, setPendingStatus] = useState("");

  // Mantengo la lógica; agrego "cancelado" como opción de cambio desde "pendiente"
  const nextStatusOptions = useMemo(() => {
    switch (order.status) {
      case "pendiente":
        return ["facturado", "cancelado"];
      case "facturado":
        return ["enviado"];
      case "enviado":
        return ["entregado"];
      case "entregado":
      case "cancelado":
      default:
        return [];
    }
  }, [order.status]);

  const handleSelectChange = (e) => {
    const next = e.target.value;
    if (!next || next === order.status) return;

    if (next === "cancelado") {
      setConfirmMode("cancel");
      setConfirmTitle("Cancelar pedido");
      setConfirmMessage(
        "¿Deseas cancelar este pedido? Se restablecerá el stock."
      );
      setConfirmOpen(true);
      return;
    }

    setPendingStatus(next);
    setConfirmMode("status");
    setConfirmTitle("Confirmar cambio de estado");
    if (next === "enviado") {
      setConfirmMessage("¿Marcar el pedido como ENVIADO?");
    } else if (next === "entregado") {
      setConfirmMessage("¿Marcar el pedido como ENTREGADO?");
    } else if (next === "facturado") {
      setConfirmMessage("¿Marcar el pedido como FACTURADO?");
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    try {
      if (confirmMode === "status") {
        await onStatusChange(order._id, pendingStatus);
      } else if (confirmMode === "cancel") {
        await onCancel(order._id);
      }
    } finally {
      setConfirmOpen(false);
      setConfirmMode(null);
      setPendingStatus("");
      setConfirmTitle("");
      setConfirmMessage("");
    }
  };

  const handleCancelModal = () => {
    setConfirmOpen(false);
    setConfirmMode(null);
    setPendingStatus("");
    setConfirmTitle("");
    setConfirmMessage("");
  };

  const badgeClass = `oc__badge is-${order.status}`;

  const unitPrice = (it) =>
    Number(
      it?.unitPrice ?? it?.product?.effectivePrice ?? it?.product?.price ?? 0
    );

  return (
    <article className="oc">
      <header className="oc__head">
        <h4 className="oc__title">
          Pedido{" "}
          <span className="oc__id">
            #{String(order._id).slice(-8).toUpperCase()}
          </span>
        </h4>
        <span className={badgeClass} aria-label={`Estado: ${order.status}`}>
          {order.status}
        </span>
      </header>

      <div className="oc__meta">
        <span>
          <b>Nombre:</b> {order.user?.name || "N/A"}
        </span>
        <span>
          <b>Email:</b> {order.user?.email || "N/A"}
        </span>
        <span>
          <b>Fecha:</b> {new Date(order.createdAt).toLocaleString()}
        </span>
        <span>
          <b>Total:</b> {formatCOP(order.total)}
        </span>
      </div>

      <div className="oc__ctrl">
        <label htmlFor={`status-${order._id}`} className="oc__label">
          Cambiar estado
        </label>
        {nextStatusOptions.length > 0 ? (
          <select
            id={`status-${order._id}`}
            onChange={handleSelectChange}
            defaultValue=""
            className="oc__select"
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {nextStatusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <em className="oc__nochanges">No hay cambios disponibles</em>
        )}
        <div className="oc__spacer" />
        {/* ⬇⬇ Estilo nuevo para el botón de detalle */}
        <button
          className="btn btn--detail"
          onClick={() => navigate(`/admin/orders/${order._id}`)}
        >
          Ver detalle
        </button>
      </div>

      <div className="oc__tablewrap">
        <table className="oc__table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Talla</th>
              <th>Color</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, i) => {
              const qty = Number(item.quantity) || 0;
              const up = unitPrice(item);
              const sub = qty * up;
              return (
                <tr key={item._id || i}>
                  <td>{item.product?.name || "Producto eliminado"}</td>
                  <td>{item?.sku || "—"}</td>
                  <td>{item.size?.label || "-"}</td>
                  <td>{item.color?.name || "-"}</td>
                  <td>{qty}</td>
                  <td>{formatCOP(up)}</td>
                  <td>{formatCOP(sub)}</td>
                </tr>
              );
            })}
            {(!order.items || order.items.length === 0) && (
              <tr>
                <td colSpan={6}>
                  <em>Sin ítems</em>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="total-label" colSpan={5}>
                Total
              </td>
              <td className="total-value">{formatCOP(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {order.status === "pendiente" && (
        <div className="oc__actions">
          <button
            className="btn btn--danger"
            onClick={() => {
              setConfirmMode("cancel");
              setConfirmTitle("Cancelar pedido");
              setConfirmMessage(
                "¿Deseas cancelar este pedido? Se restablecerá el stock."
              );
              setConfirmOpen(true);
            }}
          >
            Cancelar pedido
          </button>
        </div>
      )}

      {confirmOpen && (
        <ConfirmModal
          title={confirmTitle}
          message={confirmMessage}
          onConfirm={handleConfirm}
          onCancel={handleCancelModal}
        />
      )}
    </article>
  );
};

export default OrderCardBlock;
