import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import apiUrl from "../api/apiClient";
import { AuthContext } from "../contexts/AuthContext";

/* ===== Helpers ===== */
const fmtCOP = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const unitFromOrderItem = (it) =>
  Number(
    it?.unitPrice ?? it?.product?.effectivePrice ?? it?.product?.price ?? 0
  );

const shortId = (id = "") =>
  id ? `${String(id).slice(-8).toUpperCase()}` : "";

const stepIndexFromStatus = (status) => {
  switch ((status || "").toLowerCase()) {
    case "pendiente":
      return 0;
    case "facturado":
      return 1;
    case "enviado":
      return 2;
    case "entregado":
      return 3;
    default:
      return 0;
  }
};

const StatusBadge = ({ status }) => {
  const s = (status || "pendiente").toLowerCase();
  return <span className={`obadge is-${s}`}>{status}</span>;
};

const MyOrdersPage = () => {
  const { token } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // URL completa de la imagen
  /*const getImageUrl = (path) => {
    if (!path) return "/placeholder.jpg";
    return `${apiUrl.defaults.baseURL}${path}`;
  };
*/
  useEffect(() => {
    let mounted = true;
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await apiUrl.get("orders/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mounted) setOrders(res.data || []);
      } catch (e) {
        if (mounted) setOrders([]);
        console.error("Error cargando pedidos:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="orders">
        <h1 className="orders__title">Mis Pedidos </h1>
        <div className="orders__empty">
          <div className="orders__icon" aria-hidden />
          <p>Necesitas iniciar sesión para ver tus pedidos.</p>
          <Link to="/login" className="btn btn--primary">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="orders">
      <h1 className="orders__title">Mis Pedidos</h1>

      {loading ? (
        <div className="orders__skeleton">
          <div className="srow" />
          <div className="srow" />
          <div className="srow" />
        </div>
      ) : orders.length === 0 ? (
        <div className="orders__empty">
          <div className="orders__icon" aria-hidden />
          <h3>No tienes pedidos registrados</h3>
          <p>Cuando compres, verás el estado y detalle aquí.</p>
          <Link to="/artesanias" className="btn btn--primary">
            Explorar productos
          </Link>
        </div>
      ) : (
        <div className="orders__list">
          {orders.map((order) => {
            const step = stepIndexFromStatus(order.status);
            const created = order.createdAt
              ? new Date(order.createdAt).toLocaleString()
              : "-";

            const subtotal =
              order.items?.reduce(
                (s, it) => s + unitFromOrderItem(it) * Number(it.quantity || 0),
                0
              ) || 0;

            const shipping = Number(order.shippingCost || 0);
            const total = Number(order.total ?? subtotal + shipping);

            return (
              <article key={order._id} className="order">
                {/* Encabezado */}
                <header className="order__head">
                  <div className="order__meta">
                    <p>Pedido #</p>
                    <span className="order__id">{shortId(order._id)}</span>
                    <time className="order__date">{created}</time>
                  </div>
                  <StatusBadge status={order.status} />
                </header>

                {/* Progreso */}
                <div className="order__progress">
                  {["Recibido", "Facturado", "Enviado", "Entregado"].map(
                    (lbl, i) => (
                      <div
                        key={lbl}
                        className={`step ${i <= step ? "done" : ""}`}
                      >
                        <span className="dot" />
                        <span className="label">{lbl}</span>
                      </div>
                    )
                  )}
                </div>

                {/* Cuerpo: items + resumen */}
                <div className="order__body">
                  <ul className="order__items">
                    {order.items?.map((it, idx) => {
                      const p = it.product || {};
                      /*const img = p.images?.[0]
                        ? getImageUrl(p.images[0])
                        : "/placeholder.jpg";*/

                      const up = unitFromOrderItem(it);
                      const line = up * Number(it.quantity || 0);

                      return (
                        <li key={idx} className="oi">
                         {/* <img
                            src={img}
                            alt={p.name || "Producto"}
                            onError={(e) =>
                              (e.currentTarget.src = "/placeholder.jpg")
                            }
                          />*/}
                          <div className="oi__info">
                            <div className="oi__top">
                              <span className="oi__name">
                                {p.name || "Producto"}
                              </span>
                              <span className="oi__qty">x{it.quantity}</span>
                            </div>
                            <div className="oi__meta">
                              {it.size?.label && (
                                <span className="tag">
                                  Talla: {it.size.label}
                                </span>
                              )}
                              {it.color?.name && (
                                <span className="tag">
                                  Color: {it.color.name}
                                </span>
                              )}
                            </div>
                            <div className="oi__prices">
                              <span>{fmtCOP(up)} c/u</span>
                              <b>{fmtCOP(line)}</b>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <aside className="order__summary">
                    <div className="sum__box">
                      <h4>Resumen</h4>
                      <div className="sum__row">
                        <span>Subtotal</span>
                        <span>{fmtCOP(subtotal)}</span>
                      </div>
                      <div className="sum__row">
                        <span>Envío</span>
                        <span>
                          {shipping === 0 ? "Gratis" : fmtCOP(shipping)}
                        </span>
                      </div>
                      <hr className="sum__rule" />
                      <div className="sum__row sum__row--total">
                        <span>Total</span>
                        <b>{fmtCOP(total)}</b>
                      </div>
                    </div>
                  </aside>
                </div>

                {/* Datos de envío */}
                {["enviado", "entregado"].includes(
                  String(order.status).toLowerCase()
                ) && (
                  <div className="order__shipping">
                    <h4>Datos de envío</h4>
                    <div className="ship">
                      <div className="ship__item">
                        <span className="ship__label">Transportadora</span>
                        <b className="ship__value">
                          {order.shipping?.carrier || "—"}
                        </b>
                      </div>
                      <div className="ship__item">
                        <span className="ship__label">No. de guía</span>
                        <b className="ship__value">
                          {order.shipping?.tracking || "—"}
                        </b>
                      </div>
                      <div className="ship__item ship__item--full">
                        <span className="ship__label">
                          Comentario del administrador
                        </span>
                        <p className="ship__note">
                          {order.shipping?.note || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
