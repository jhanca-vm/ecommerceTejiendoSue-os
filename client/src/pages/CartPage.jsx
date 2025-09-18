import { useContext, useEffect, useMemo, useState } from "react";
import { CartContext } from "../contexts/CartContext";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

import apiUrl from "../api/apiClient";

import CartItem from "../blocks/users/CartItem";
import CheckoutModal from "../blocks/users/CheckoutModal";
import { useToast } from "../contexts/ToastContext";

const ADMIN_WHATSAPP = "573147788069";

/** Formatea a COP sin decimales */
const fmtCOP = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/** Devuelve el precio unitario que se debe cobrar (effectivePrice o price) */
const unitPrice = (product) =>
  typeof product?.effectivePrice !== "undefined"
    ? Number(product.effectivePrice)
    : Number(product?.price || 0);

/* ---------------- Resolver de productos ---------------- */

/**
 * Toma una lista de ids y retorna un mapa { [productId]: product }
 * Intenta usar /api/products/bulk con ids como ARRAY (?ids=a&ids=b).
 * Si no existe, cae a GET por id.
 */
function useProductsMap(ids, token) {
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const unique = Array.from(new Set((ids || []).filter(Boolean)));
      if (unique.length === 0) {
        setMap({});
        return;
      }
      setLoading(true);
      try {
        // 1) Intento bulk con ARRAY en params (NADA de join(","))
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;
        try {
          const r = await apiUrl.get("products/bulk", {
            params: { ids: unique }, // 👈 clave del cambio
            headers,
          });
          if (!cancel) {
            const obj = {};
            for (const p of r.data || []) obj[String(p._id)] = p;
            setMap(obj);
          }
        } catch {
          // 2) Fallback: por id
          const results = await Promise.all(
            unique.map(async (id) => {
              try {
                const rr = await apiUrl.get(`products/${id}`, { headers });
                return rr.data;
              } catch {
                return null;
              }
            })
          );
          if (!cancel) {
            const obj = {};
            for (const p of results.filter(Boolean)) obj[String(p._id)] = p;
            setMap(obj);
          }
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    run();
    return () => {
      cancel = true;
    };
  }, [ids, token]);

  return { map, loading };
}

/* ---------------- Página ---------------- */

const CartPage = () => {
  // 👇 Usamos la capa de compatibilidad del contexto para no romper CartItem
  // Si tu CartContext no expone cartLegacy aún, usa { cartLegacy: cart } en el Provider
  const {
    cartLegacy: cart,
    updateItem,
    removeFromCart,
    clearCart,
  } = useContext(CartContext);
  const { token, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Lista de productIds presentes
  const productIds = useMemo(
    () => cart.map((it) => it?.product?._id).filter(Boolean),
    [cart]
  );

  // Trae datos reales de productos (name, price, images, discount…)
  const { map: productsMap } = useProductsMap(productIds, token);

  // Ítems enriquecidos: mantiene shape legacy esperado por CartItem,
  // pero con product poblado si está disponible.
  const displayItems = useMemo(
    () =>
      cart.map((it) => {
        const pid = it?.product?._id;
        const resolved = pid ? productsMap[pid] : null;
        // siempre garantizamos que product tenga al menos {_id}
        const product =
          resolved ||
          (pid ? { _id: pid } : { _id: "unknown", name: "Producto" });
        return {
          ...it,
          product,
        };
      }),
    [cart, productsMap]
  );

  /** Subtotal (sumatoria líneas) */
  const subtotal = useMemo(
    () =>
      displayItems.reduce(
        (sum, it) => sum + unitPrice(it.product) * (Number(it.quantity) || 0),
        0
      ),
    [displayItems]
  );

  /** En un futuro aquí podrías calcular envío, impuestos, cupones, etc. */
  const shipping = 0;
  const taxes = 0;
  const total = subtotal + shipping + taxes;

  const toOrderItems = () =>
    displayItems.map((item) => ({
      product: item.product?._id,
      size: item.size?._id || null,
      color: item.color?._id || null,
      quantity: Number(item.quantity) || 1,
    }));

  const startCheckout = () => {
    if (!token) {
      showToast("Debes iniciar sesión para realizar el pedido.", "warning");
      return navigate("/login");
    }
    if (displayItems.length === 0) {
      showToast("Tu carrito está vacío.", "info");
      return;
    }
    setOpenModal(true);
  };

  const buildWhatsAppText = (order, shippingInfo, humanCode) => {
    const lines = [];
    const orderCode = humanCode || order._id;
    lines.push("*Nuevo pedido*");
    lines.push(`ID: ${orderCode}`);
    if (shippingInfo) {
      lines.push(
        `Envío: ${shippingInfo.fullName} | Tel: ${shippingInfo.phone}`
      );
      lines.push(`${shippingInfo.address}, ${shippingInfo.city}`);
      if (shippingInfo.notes) lines.push(`Notas: ${shippingInfo.notes}`);
    }
    lines.push("");
    lines.push("*Detalle:*");
    order.items.forEach((it) => {
      const name = it?.product?.name || "Producto";
      const sku  = it?.product?.sku ? ` [${it.product.sku}]` : "";
      const size = it?.size?.label ? ` / Talla: ${it.size.label}` : "";
      const color = it?.color?.name ? ` / Color: ${it.color.name}` : "";
      lines.push(
        `- ${name}${sku}${size}${color} x${it.quantity} = ${fmtCOP(
          it.unitPrice * it.quantity
        )}`
      );
    });
    lines.push("");
    lines.push(`*Total:* ${fmtCOP(order.total)}`);
    return encodeURIComponent(lines.join("\n"));
  };

  const confirmCheckout = async (shippingInfo) => {
    setLoading(true);
    try {
      const items = toOrderItems();
      const idem =
        crypto?.randomUUID?.() ||
        `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const { data } = await apiUrl.post(
        `orders`,
        { items, shippingInfo, idempotencyKey: idem, source: "cart" },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": idem,
          },
        }
      );

      const order = data.order;

      // Código legible para mostrar (no afecta backend)
      const humanCode = `${new Date(order.createdAt || Date.now())
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${String(order._id).slice(-6).toUpperCase()}`;

      // Intento de copiar al portapapeles (no crítico)
      try {
        await navigator.clipboard?.writeText(humanCode);
      } catch {}

      const text = buildWhatsAppText(order, shippingInfo, humanCode);
      const waLink = `https://wa.me/${ADMIN_WHATSAPP}?text=${text}`;
      window.open(waLink, "_blank", "noopener,noreferrer");

      showToast(`Pedido creado: ${humanCode}`, "success");
      clearCart();
      navigate("/my-orders");
    } catch (err) {
      showToast(
        "Error al realizar el pedido: " +
          (err.response?.data?.error || "Intenta más tarde."),
        "error"
      );
    } finally {
      setLoading(false);
      setOpenModal(false);
    }
  };

  return (
    <div className="cart">
      <h1 className="cart__title">Carrito de Compras</h1>

      {displayItems.length === 0 ? (
        <div className="cart__empty">
          <div className="cart__bag" aria-hidden />
          <h3>Tu carrito está vacío</h3>
          <p>Explora nuestras artesanías y encuentra tu próximo favorito.</p>
          <Link to="/artesanias" className="btn btn--primary">
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="cart__grid">
          {/* Lista de ítems */}
          <section className="cart__list" aria-label="Productos en el carrito">
            {displayItems.map((item) => {
              const key = `${item.product?._id || "p"}-${
                item.size?._id || ""
              }-${item.color?._id || ""}`;
              return (
                <div key={key} className="cart__row">
                  {/* CartItem: espera item.product (obj), item.size/color (obj|null) */}
                  <CartItem
                    item={item}
                    updateItem={updateItem}
                    removeFromCart={removeFromCart}
                  />

                  {/* Totales por ítem */}
                  <div className="cart__line">
                    <span>
                      {fmtCOP(unitPrice(item.product))} × {item.quantity}
                    </span>
                    <b>
                      {fmtCOP(
                        unitPrice(item.product) * (Number(item.quantity) || 0)
                      )}
                    </b>
                  </div>
                </div>
              );
            })}

            <div className="cart__actions">
              <Link to="/artesanias" className="btn btn--ghost">
                ← Seguir comprando
              </Link>
              <button
                className="btn btn--danger"
                onClick={() => {
                  if (confirm("¿Vaciar el carrito?")) clearCart();
                }}
              >
                Vaciar carrito
              </button>
            </div>
          </section>

          {/* Resumen / Checkout */}
          <aside className="cart__summary" aria-label="Resumen de compra">
            <div className="sum__box">
              <h3>Resumen</h3>

              <div className="sum__row">
                <span>Subtotal</span>
                <span>{fmtCOP(subtotal)}</span>
              </div>
              <div className="sum__row">
                <span>Envío</span>
                <span>{shipping === 0 ? "Gratis" : fmtCOP(shipping)}</span>
              </div>
              <div className="sum__row">
                <span>Impuestos</span>
                <span>{taxes === 0 ? "-" : fmtCOP(taxes)}</span>
              </div>

              <hr className="sum__rule" />

              <div className="sum__row sum__row--total">
                <span>Total a pagar</span>
                <b>{fmtCOP(total)}</b>
              </div>

              <button
                className="btn btn--primary sum__checkout"
                disabled={loading}
                onClick={startCheckout}
              >
                {loading ? "Procesando..." : "Finalizar compra"}
              </button>

              <p className="sum__hint">
                Pagas de forma segura. Al confirmar, podrás coordinar el envío
                por WhatsApp con nuestro equipo.
              </p>
            </div>
          </aside>
        </div>
      )}

      <CheckoutModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={confirmCheckout}
      />
    </div>
  );
};

export default CartPage;
