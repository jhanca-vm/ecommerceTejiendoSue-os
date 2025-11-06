// src/pages/CartPage.jsx
import { useContext, useEffect, useMemo, useState } from "react";
import { CartContext } from "../contexts/CartContext";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

import apiUrl from "../api/apiClient";

import CartItem from "../blocks/users/CartItem";
import CheckoutModal from "../blocks/users/CheckoutModal";
import { useToast } from "../contexts/ToastContext";
import { buildWhatsAppUrl } from "../utils/whatsapp";
import SuccessOverlay from "../blocks/SuccessOverlay";

const ADMIN_WHATSAPP = "573147788069";

/* ====================== Utils ====================== */
const fmtCOP = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const unitPrice = (product) =>
  Number(
    typeof product?.effectivePrice !== "undefined"
      ? product.effectivePrice
      : product?.price || 0
  );

const sidEq = (a, b) => String(a ?? "") === String(b ?? "");

/* =================== Productos map (bulk con fallback) ================== */
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
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        // 1) Preferimos /products/bulk (tu backend ya devuelve variants con label/name)
        const r = await apiUrl.get("products/bulk", {
          params: { ids: unique }, // múltiples ?ids=... soportado por tu ruta
          headers,
        });
        const obj = {};
        for (const p of r.data || []) obj[String(p._id)] = p;
        if (!cancel) setMap(obj);
      } catch {
        // 2) Fallback por id
        try {
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
          const obj = {};
          for (const p of results.filter(Boolean)) obj[String(p._id)] = p;
          if (!cancel) setMap(obj);
        } catch {
          if (!cancel) setMap({});
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

/* ====== Resolver etiquetas desde product.variants ====== */
function resolveSizeFromVariants(product, sizeId) {
  if (!product || !sizeId) return null;
  const vars = Array.isArray(product.variants) ? product.variants : [];

  // 1) match exacto por size._id
  const hit = vars.find((v) => sidEq(v?.size?._id, sizeId));
  if (hit?.size) {
    return {
      _id: String(hit.size._id),
      label: hit.size.label ?? String(hit.size._id),
    };
  }

  // 2) como plan B, arma un índice por sizeId (por si hay varias combinaciones)
  const bySize = new Map();
  for (const v of vars) {
    if (v?.size?._id) {
      bySize.set(String(v.size._id), {
        _id: String(v.size._id),
        label: v.size.label ?? String(v.size._id),
      });
    }
  }
  const fromIndex = bySize.get(String(sizeId));
  return fromIndex || null;
}

function resolveColorFromVariants(product, colorId) {
  if (!product || !colorId) return null;
  const vars = Array.isArray(product.variants) ? product.variants : [];

  // 1) match exacto por color._id
  const hit = vars.find((v) => sidEq(v?.color?._id, colorId));
  if (hit?.color) {
    return {
      _id: String(hit.color._id),
      name: hit.color.name ?? String(hit.color._id),
    };
  }

  // 2) índice por colorId
  const byColor = new Map();
  for (const v of vars) {
    if (v?.color?._id) {
      byColor.set(String(v.color._id), {
        _id: String(v.color._id),
        name: v.color.name ?? String(v.color._id),
      });
    }
  }
  const fromIndex = byColor.get(String(colorId));
  return fromIndex || null;
}

/* ======================= Página ======================= */
const CartPage = () => {
  // Contextos (con fallback seguro)
  const {
    cartLegacy: cart = [],
    updateItem,
    removeFromCart,
    clearCart,
  } = useContext(CartContext);
  const { token, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  // ids de productos presentes
  const productIds = useMemo(
    () => (cart || []).map((it) => it?.product?._id).filter(Boolean),
    [cart]
  );

  // Trae productos (bulk; si falla, por id). Tu /bulk ya incluye variants pobladas.
  const { map: productsMap } = useProductsMap(productIds, token);

  // Ítems listos para pintar (resuelve size.label y color.name desde variants)
  const displayItems = useMemo(() => {
    return (cart || []).map((it) => {
      const pid = it?.product?._id;
      const product =
        (pid && productsMap[pid]) ||
        (pid ? { _id: pid } : { _id: "unknown", name: "Producto" });

      // size/color pueden venir como objeto, id plano o *_id
      const sid =
        it?.size?._id ??
        (typeof it?.size === "string" ? it.size : it?.sizeId) ??
        null;
      const cid =
        it?.color?._id ??
        (typeof it?.color === "string" ? it.color : it?.colorId) ??
        null;

      // Resuelve etiquetas desde product.variants (que ya traen {size:{_id,label}, color:{_id,name}})
      let size = sid ? resolveSizeFromVariants(product, sid) : null;
      let color = cid ? resolveColorFromVariants(product, cid) : null;

      // Si no encontró (producto sin variants), usa id plano para no romper UI
      if (!size && sid) size = { _id: String(sid), label: String(sid) };
      if (!color && cid) color = { _id: String(cid), name: String(cid) };

      return {
        ...it,
        product,
        size: size ?? null,
        color: color ?? null,
      };
    });
  }, [cart, productsMap]);

  // Totales
  const subtotal = useMemo(
    () =>
      displayItems.reduce(
        (sum, it) => sum + unitPrice(it.product) * (Number(it.quantity) || 0),
        0
      ),
    [displayItems]
  );
  const shipping = 0;
  const taxes = 0;
  const total = subtotal + shipping + taxes;

  // Payload para orden
  const getOrderItemsPayload = () =>
    displayItems.map((item) => ({
      product: item.product?._id,
      size: item.size?._id ?? null,
      color: item.color?._id ?? null,
      quantity: Number(item.quantity) || 1,
    }));

  // Checkout
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState({ open: false, humanCode: "" });

  const startCheckout = () => {
    if (!token) {
      showToast("Debes iniciar sesión para realizar el pedido.", "warning");
      return navigate("/login");
    }
    if (displayItems.length === 0) {
      showToast("Tu carrito está vacío.", "info");
      return;
    }
    // Navega a la nueva página de checkout, pasando los items y el total
    navigate("/checkout", { state: { items: getOrderItemsPayload(), total } });
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
                  <CartItem
                    item={item}
                    updateItem={updateItem}
                    removeFromCart={removeFromCart}
                  />
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
              <Link to="/tienda" className="btn btn--ghost">
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

      <SuccessOverlay
        open={success.open}
        humanCode={success.humanCode}
        onPrimary={() => {
          setSuccess({ open: false, humanCode: "" });
          navigate("/artesanias");
        }}
        onSecondary={() => {
          setSuccess({ open: false, humanCode: "" });
          navigate("/my-orders");
        }}
        onClose={() => setSuccess({ open: false, humanCode: "" })}
      />
    </div>
  );
};

export default CartPage;
