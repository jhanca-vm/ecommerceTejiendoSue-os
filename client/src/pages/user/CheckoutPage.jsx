// src/pages/CheckoutPage.jsx
import { useState, useContext, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { CartContext } from "../../contexts/CartContext";
import { useToast } from "../../contexts/ToastContext";
import apiUrl from "../../api/apiClient";
import { buildWhatsAppUrl } from "../../utils/whatsapp";
import SuccessOverlay from "../../blocks/SuccessOverlay";

const ADMIN_WHATSAPP = "573147788069"; // Considera mover esto a una variable de entorno

const fmtCOP = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { token, user } = useContext(AuthContext);
  const { clearCart } = useContext(CartContext);

  // Recuperar datos del carrito pasados desde la navegación
  const { items: orderItems, total } = location.state || {};

  const [shippingInfo, setShippingInfo] = useState({
    name: user?.name || "",
    address: "",
    city: "",
    department: "",
    phone: user?.phone || "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState({ open: false, humanCode: "" });

  // Si no hay items, redirigir al carrito
  useEffect(() => {
    if (!orderItems || orderItems.length === 0) {
      showToast(
        "No hay productos para procesar. Volviendo al carrito.",
        "warning"
      );
      navigate("/cart");
    }
  }, [orderItems, navigate, showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setShippingInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !shippingInfo.address ||
      !shippingInfo.city ||
      !shippingInfo.department ||
      !shippingInfo.phone
    ) {
      return showToast(
        "Por favor, completa todos los campos de envío.",
        "error"
      );
    }

    setLoading(true);
    try {
      const idem = crypto.randomUUID();
      const { data } = await apiUrl.post(
        `orders`,
        {
          items: orderItems,
          shippingInfo,
          idempotencyKey: idem,
          source: "checkout-page",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": idem,
          },
        }
      );

      const order = data.order;
      const humanCode = `${new Date(order.createdAt || Date.now())
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${String(order._id).slice(-6).toUpperCase()}`;

      // --- MODIFICACIÓN FUTURA (Punto 2 de tu solicitud) ---
      // Aquí es donde, en el futuro, llamarías a tu backend para que envíe el mensaje de WhatsApp
      // Por ahora, mantenemos el comportamiento actual.
      const waUrl = buildWhatsAppUrl(
        ADMIN_WHATSAPP,
        order,
        { name: user?.name, email: user?.email },
        shippingInfo,
        {
          humanCode,
          includeSKU: true,
          includeVariant: true,
          includeImages: true,
        }
      );
      window.open(waUrl, "_blank", "noopener,noreferrer");
      // --- FIN MODIFICACIÓN FUTURA ---

      clearCart();
      setSuccess({ open: true, humanCode });
      showToast(`Pedido creado: ${humanCode}`, "success");
    } catch (err) {
      showToast(
        "Error al realizar el pedido: " +
          (err?.response?.data?.error || "Intenta más tarde."),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!orderItems) return null; // Evita renderizar si no hay estado

  return (
    <>
      <div className="checkout-page container">
        <h1 className="checkout-page__title">Finalizar Compra</h1>
        <div className="checkout-page__grid">
          <div className="checkout-page__form">
            <h2>Información de Envío</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Nombre de quien recibe</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={shippingInfo.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="address">Dirección de envío</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={shippingInfo.address}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="city">Ciudad</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={shippingInfo.city}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="department">Departamento</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={shippingInfo.department}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Teléfono de contacto</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={shippingInfo.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="notes">Notas adicionales (opcional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={shippingInfo.notes}
                  onChange={handleChange}
                  rows="3"
                ></textarea>
              </div>
              <div className="checkout-page__actions">
                <Link to="/cart" className="btn btn--ghost">
                  ← Volver al carrito
                </Link>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={loading}
                >
                  {loading
                    ? "Procesando..."
                    : `Confirmar y Pagar ${fmtCOP(total)}`}
                </button>
              </div>
            </form>
          </div>
          <aside className="checkout-page__summary">
            <h2>Resumen del Pedido</h2>
            <div className="sum__row sum__row--total">
              <span>Total a pagar</span>
              <b>{fmtCOP(total)}</b>
            </div>
            <p className="sum__hint">
              Serás redirigido a WhatsApp para coordinar el pago y envío con
              nuestro equipo.
            </p>
            {/* Aquí podrías mostrar un resumen de los productos si lo deseas */}
          </aside>
        </div>
      </div>
      <SuccessOverlay
        open={success.open}
        humanCode={success.humanCode}
        onPrimary={() => navigate("/artesanias")}
        onSecondary={() => navigate("/my-orders")}
        onClose={() => setSuccess({ open: false, humanCode: "" })}
      />
    </>
  );
}
