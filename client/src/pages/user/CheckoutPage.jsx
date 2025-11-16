// src/pages/CheckoutPage.jsx
import { useState, useContext, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { CartContext } from "../../contexts/CartContext"; // Para limpiar el carrito
import { useToast } from "../../contexts/ToastContext";
import useWompi from "../../hooks/useWompi";
import apiUrl, { getBaseUrl } from "../../api/apiClient";
import SuccessOverlay from "../../blocks/SuccessOverlay";

const ADMIN_WHATSAPP = "573147788069"; // Considera mover esto a una variable de entorno

const fmtCOP = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/**
 * Hook para enriquecer los items del pedido.
 * Si los items vienen solo con IDs (desde "Comprar ahora"),
 * busca los detalles completos del producto en el backend.
 */
function useEnrichedOrderItems(initialItems) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const enrich = async () => {
      if (!initialItems || initialItems.length === 0) {
        setError("No hay productos para procesar.");
        setLoading(false);
        return;
      }

      // Revisa si el primer item ya tiene detalles (ej: `product.name`)
      const isEnriched = initialItems[0]?.product?.name;

      if (isEnriched) {
        setItems(initialItems);
        setLoading(false);
        return;
      }

      // Si no están enriquecidos, busca los detalles
      try {
        const productIds = initialItems
          .map((item) => item.product)
          .filter(Boolean);
        if (productIds.length === 0) {
          setError("No se encontraron IDs de producto válidos.");
          setLoading(false);
          return;
        }

        // Usamos la ruta /bulk para eficiencia
        const { data: products } = await apiUrl.get("products/bulk", {
          params: { ids: productIds },
        });

        const productsMap = new Map(products.map((p) => [p._id, p]));

        const enrichedItems = initialItems
          .map((item) => {
            const productDetails = productsMap.get(item.product);
            if (!productDetails) return null; // Producto no encontrado, se podría filtrar

            return {
              ...item,
              product: productDetails, // Reemplaza el ID por el objeto completo
            };
          })
          .filter(Boolean); // Filtra los nulos

        if (isMounted) {
          setItems(enrichedItems);
        }
      } catch (err) {
        console.error("Error enriqueciendo items:", err);
        if (isMounted) {
          setError("Error al cargar los detalles de los productos.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    enrich();

    return () => {
      isMounted = false;
    };
  }, [initialItems]);

  return { items, loading, error };
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { token, user } = useContext(AuthContext);
  const { clearCart } = useContext(CartContext);
  const baseUrl = getBaseUrl();

  const [shippingInfo, setShippingInfo] = useState({
    name: user?.name || "",
    address: "",
    city: "",
    department: "",
    phone: user?.phone || "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState({ open: false, humanCode: "" });

  // 1. Recuperar datos del state de la navegación
  const { items: initialOrderItems, total } = location.state || {};

  // 2. Usar el hook para enriquecer los items si es necesario
  const {
    items: orderItems,
    loading: loadingItems,
    error: itemsError,
  } = useEnrichedOrderItems(initialOrderItems);

  // 3. Usar el hook de Wompi
  const { ref: wompiRef, loading: loadingWompi } = useWompi();

  // 4. Manejar errores o la ausencia de items
  useEffect(() => {
    if (itemsError) {
      showToast(itemsError, "error");
      navigate("/cart");
    } else if (!loadingItems && (!orderItems || orderItems.length === 0)) {
      showToast(
        "No hay productos para procesar. Volviendo al carrito.",
        "warning"
      );
      navigate("/cart");
    }
  }, [orderItems, loadingItems, itemsError, navigate, showToast]);

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

    setSubmitting(true);
    try {
      wompiRef.current.open(async ({ transaction }) => {
        if (transaction) {
          const idem = transaction.reference;

          // Asegurarse de que los items enviados al backend solo contengan los IDs
          const payloadItems = orderItems.map((item) => ({
            product: item.product._id,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
          }));

          const { data } = await apiUrl.post(
            `orders`,
            {
              items: payloadItems,
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

          clearCart();
          setSuccess({ open: true, humanCode });
          showToast(`Pedido creado: ${humanCode}`, "success");
        }
      })
    } catch (err) {
      showToast(
        "Error al realizar el pedido: " +
          (err?.response?.data?.error || "Intenta más tarde."),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Muestra un estado de carga mientras se cargan todos los datos necesarios
  if (loadingItems || loadingWompi) {
    return (
      <div
        className="container"
        style={{ padding: "2rem", textAlign: "center" }}
      >
        Cargando detalles del pedido...
      </div>
    );
  }

  if (!orderItems) return null;

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
                  disabled={submitting}
                >
                  {submitting
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
