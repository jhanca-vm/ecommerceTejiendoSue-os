import { useState, useContext, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

import apiUrl, { getBaseUrl } from "../../api/apiClient";

import { AuthContext } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import ProductPriceBlock from "../ProductPrice";
import FavoriteButton from "./FavoriteButton";
import CheckoutModal from "../users/CheckoutModal";
import SuccessOverlay from "././../SuccessOverlay";

import { buildWhatsAppUrl } from "../../utils/whatsapp";

/* ================= Helpers y utilidades ================= */
const ADMIN_WHATSAPP = "573147788069";

const idVal = (x) =>
  typeof x === "object" && x?._id ? String(x._id) : String(x || "");

const computeEffectiveFallback = (product) => {
  const price = Number(product?.price || 0);
  const d = product?.discount;
  if (!d?.enabled || !price) return price;

  const now = new Date();
  const start = d.startAt ? new Date(d.startAt) : null;
  const end = d.endAt ? new Date(d.endAt) : null;
  if ((start && now < start) || (end && now > end)) return price;

  let eff = price;
  if (d.type === "PERCENT") eff = price - (price * Number(d.value || 0)) / 100;
  else eff = price - Number(d.value || 0);
  return Math.max(0, Number(eff.toFixed(2)));
};

const Star = ({ filled = false, className = "" }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`star ${className}`}>
    <path
      d="M12 17.3l-6.18 3.73L7 14.25 2 9.97l6.91-1.01L12 3l3.09 5.96L22 9.97l-5 4.28 1.18 6.78z"
      className={filled ? "filled" : ""}
    />
  </svg>
);

const StarRatingDisplay = ({ value = 0, size = "md" }) => {
  const n = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className={`rating rating--${size}`} title={`${n.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= Math.round(n)} />
      ))}
      <b>{n.toFixed(1)}</b>
    </div>
  );
};

const StarRatingInput = ({ value, onChange }) => {
  return (
    <div className="rating-input" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((v) => (
        <label
          key={v}
          className="rating-input__opt"
          aria-label={`${v} estrellas`}
          title={`${v} estrellas`}
          style={{ cursor: "pointer" }}
        >
          <input
            type="radio"
            name="stars"
            value={v}
            checked={Number(value) === v}
            onChange={() => onChange(v)}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
          />
          <Star filled={v <= value} />
        </label>
      ))}
    </div>
  );
};

const MiniCard = ({ item }) => {
  const mainImage = item?.images?.[0] || "/placeholder.jpg";
  const effective =
    typeof item?.effectivePrice !== "undefined"
      ? item.effectivePrice
      : computeEffectiveFallback(item);

  const baseUrl = getBaseUrl();

  return (
    <Link to={`/product/${item?._id}`} className="mini">
      <img
        src={`${baseUrl}${mainImage}`}
        onError={(e) => (e.currentTarget.src = "/placeholder.jpg")}
        alt={item?.name}
        loading="lazy"
      />
      <div className="mini__body">
        <span className="mini__title">{item?.name}</span>
        <div className="mini__price">
          <ProductPriceBlock price={item?.price} effectivePrice={effective} />
        </div>
      </div>
    </Link>
  );
};

/* ================= Componente principal ================= */
const ProductDetailBlock = ({
  product,
  onAddToCart,
  featuredProducts = [],
}) => {
  const images = product?.images?.length
    ? product.images
    : ["/placeholder.jpg"];
  const [selectedImage, setSelectedImage] = useState(images[0]);

  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [availableStock, setAvailableStock] = useState(0);
  const [eligible, setEligible] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const baseUrl = getBaseUrl();

  const { user, token } = useContext(AuthContext); // ⬅️ token para comprar
  const { showToast } = useToast();
  const navigate = useNavigate();

  /* ----- Lightbox state ----- */
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const touchStartX = useRef(null);

  /*  Destacados*/
  const [recs, setRecs] = useState({
    similar: [],
    complementary: [],
    fallback: [],
  });
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recsError, setRecsError] = useState("");

  const openLightbox = (idx) => {
    setLbIndex(idx);
    setLbOpen(true);
  };
  const closeLightbox = () => setLbOpen(false);
  const goPrev = () =>
    setLbIndex((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setLbIndex((i) => (i + 1) % images.length);

  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lbOpen, images.length]);

  useEffect(() => {
    if (!lbOpen) return;
    const preload = (src) => {
      const img = new Image();
      img.src = `${baseUrl}${src}`;
    };
    preload(images[(lbIndex + 1) % images.length]);
    preload(images[(lbIndex - 1 + images.length) % images.length]);
  }, [lbOpen, lbIndex, images, baseUrl]);

  const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const TH = 40;
    if (dx > TH) goPrev();
    else if (dx < -TH) goNext();
  };

  /* ----- Catálogos ----- */
  useEffect(() => {
    const fetchSizeAndColorNames = async () => {
      try {
        const [sizeRes, colorRes] = await Promise.all([
          apiUrl.get("sizes"),
          apiUrl.get("colors"),
        ]);
        setSizes(sizeRes.data);
        setColors(colorRes.data);
      } catch {
        showToast("Error al cargar tallas o colores", "error");
      }
    };
    fetchSizeAndColorNames();
  }, [showToast]);

  /* ----- Stock por variante ----- */
  useEffect(() => {
    if (selectedSize && selectedColor) {
      const variant = product.variants.find(
        (v) =>
          idVal(v.size) === selectedSize && idVal(v.color) === selectedColor
      );
      const stock = Number(variant?.stock || 0);
      setAvailableStock(stock);
      if (quantity > stock) setQuantity(1);
    } else {
      setAvailableStock(0);
      setQuantity(1);
    }
  }, [selectedSize, selectedColor, product.variants, quantity]);

  const availableSizes = useMemo(() => {
    const sizeIdsInProduct = new Set(
      product.variants.map((v) => idVal(v.size))
    );
    if (sizes?.length)
      return sizes.filter((s) => sizeIdsInProduct.has(String(s._id)));
    const map = new Map();
    product.variants.forEach((v) => {
      const s = v.size;
      if (s && typeof s === "object" && s._id && s.label)
        map.set(String(s._id), { _id: String(s._id), label: s.label });
      else {
        const id = idVal(s);
        map.set(id, { _id: id, label: id });
      }
    });
    return Array.from(map.values());
  }, [product.variants, sizes]);

  useEffect(() => {
    if (
      selectedSize &&
      !availableSizes.some((s) => String(s._id) === selectedSize)
    ) {
      setSelectedSize("");
      setSelectedColor("");
    }
  }, [availableSizes, selectedSize]);

  const getColorsForSelectedSize = () => {
    if (!selectedSize) return [];
    const variantsForSize = product.variants.filter(
      (v) => idVal(v.size) === selectedSize
    );
    const colorIds = new Set(variantsForSize.map((v) => idVal(v.color)));
    const fromCatalog = colors.filter((c) => colorIds.has(String(c._id)));
    if (fromCatalog.length) return fromCatalog;

    const map = new Map();
    variantsForSize.forEach((v) => {
      const c = v.color;
      if (c && typeof c === "object" && c._id && c.name)
        map.set(String(c._id), { _id: String(c._id), name: c.name });
      else {
        const id = idVal(c);
        map.set(id, { _id: id, name: id });
      }
    });
    return Array.from(map.values());
  };

  /* ----- Carrito (agregar) ----- */
  const handleAdd = () => {
    if (!user || user.role === "admin") {
      showToast("Debes iniciar sesión como usuario para comprar", "warning");
      return navigate("/login");
    }
    if (!selectedSize || !selectedColor) {
      showToast("Debes seleccionar talla y color", "warning");
      return;
    }
    const variant = product.variants.find(
      (v) => idVal(v.size) === selectedSize && idVal(v.color) === selectedColor
    );
    if (!variant) return showToast("Variante no disponible", "error");
    if (variant.stock < quantity)
      return showToast("Stock insuficiente", "error");

    const sizeObj = sizes.find((s) => String(s._id) === selectedSize) || {
      _id: selectedSize,
    };
    const colorObj = colors.find((c) => String(c._id) === selectedColor) || {
      _id: selectedColor,
    };
    const cartItem = { ...product, size: sizeObj, color: colorObj };
    onAddToCart(cartItem, quantity);
    showToast({
      message: "Producto agregado al carrito",
      type: "success",
      duration: 5000,
      actions: [
        { label: "Ir al carrito", onClick: () => navigate("/cart") },
        { label: "Seguir comprando", onClick: () => {} },
      ],
    });
  };

  /* ----- Comprar ahora ----- */
  const [openBuyNow, setOpenBuyNow] = useState(false);
  const [loadingBuyNow, setLoadingBuyNow] = useState(false);
  const [success, setSuccess] = useState({ open: false, humanCode: "" });

  const handleBuyNow = () => {
    if (!user || user.role === "admin") {
      showToast("Debes iniciar sesión como usuario para comprar", "warning");
      return navigate("/login");
    }
    if (!selectedSize || !selectedColor) {
      showToast("Debes seleccionar talla y color", "warning");
      return;
    }
    const variant = product.variants.find(
      (v) => idVal(v.size) === selectedSize && idVal(v.color) === selectedColor
    );
    if (!variant) return showToast("Variante no disponible", "error");
    if (variant.stock < quantity)
      return showToast("Stock insuficiente", "error");
    setOpenBuyNow(true);
  };

  const confirmBuyNow = async (shippingInfo) => {
    setLoadingBuyNow(true);
    try {
      const idem =
        crypto?.randomUUID?.() ||
        `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const items = [
        {
          product: product._id,
          size: selectedSize,
          color: selectedColor,
          quantity: Number(quantity) || 1,
        },
      ];

      const { data } = await apiUrl.post(
        "orders",
        { items, shippingInfo, idempotencyKey: idem },
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

      try {
        await navigator.clipboard?.writeText(humanCode);
      } catch {}
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
      console.log(order.items);
      window.open(waUrl, "_blank", "noopener,noreferrer");

      showToast(`Pedido creado: ${humanCode}`, "success");
      setSuccess({ open: true, humanCode });
    } catch (err) {
      showToast(
        "Error al realizar el pedido: " +
          (err?.response?.data?.error || "Intenta más tarde."),
        "error"
      );
    } finally {
      setLoadingBuyNow(false);
      setOpenBuyNow(false);
    }
  };

  /* ----- Precio ----- */
  const effectivePrice =
    typeof product.effectivePrice !== "undefined"
      ? product.effectivePrice
      : computeEffectiveFallback(product);

  /* ======= Reseñas (backend) ======= */
  const isUser = !!user && user.role === "user";

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    avg: 0,
    total: 0,
    dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [myReviewId, setMyReviewId] = useState(null);
  const [myRating, setMyRating] = useState(5);
  const [myText, setMyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const fetchReviews = async () => {
    const { data } = await apiUrl.get(`/reviews/product/${product._id}`, {
      params: { page: 1, limit: 10 },
    });
    setReviews(Array.isArray(data?.items) ? data.items : []);
    setStats(
      data?.stats || {
        avg: 0,
        total: 0,
        dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
    );
    setEligible(Boolean(data?.eligible ?? true));
    setLoadingReviews(true);
    try {
      const { data } = await apiUrl.get(`/reviews/product/${product._id}`, {
        params: { page: 1, limit: 10 },
      });
      setReviews(Array.isArray(data?.items) ? data.items : []);
      setStats(
        data?.stats || {
          avg: 0,
          total: 0,
          dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        }
      );
      if (data?.myReview) {
        setMyReviewId(data.myReview.id || data.myReview._id || null);
        setMyRating(Number(data.myReview.rating || 5));
        setMyText(String(data.myReview.text || ""));
      } else {
        setMyReviewId(null);
        setMyRating(5);
        setMyText("");
      }
    } catch {
      setReviews([]);
      setStats({ avg: 0, total: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
      setMyReviewId(null);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      await fetchReviews();
      if (cancel) return;
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product._id]);

  // Previews cuando cambian files
  useEffect(() => {
    previews.forEach((u) => URL.revokeObjectURL(u));
    const next = files.map((f) => URL.createObjectURL(f));
    setPreviews(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const onPickFiles = (e) => {
    const list = Array.from(e.target.files || []);
    const safe = list.slice(0, 4).filter((f) => f.size <= 3 * 1024 * 1024);
    setFiles(safe);
  };
  const removePicked = (i) =>
    setFiles((arr) => arr.filter((_, idx) => idx !== i));

  // Guardar/editar (upsert) reseña (JSON o multipart)
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isUser) {
      showToast(
        user ? "Solo usuarios pueden reseñar" : "Inicia sesión para reseñar",
        user ? "warning" : "info"
      );
      return;
    }
    const txt = myText.trim();
    if (!txt) return showToast("Escribe tu opinión", "warning");
    if (txt.length > 2000)
      return showToast("Máximo 2000 caracteres", "warning");

    setSubmitting(true);
    try {
      let resp;
      if (files.length) {
        const fd = new FormData();
        fd.append("rating", String(myRating));
        fd.append("text", txt);
        files.forEach((f) => fd.append("images", f));
        resp = await apiUrl.post(`/reviews/product/${product._id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        resp = await apiUrl.post(`/reviews/product/${product._id}`, {
          rating: myRating,
          text: txt,
        });
      }

      if (resp?.data?.stats) setStats(resp.data.stats);
      // Limpiar y refrescar
      setMyText("");
      setMyRating(5);
      setFiles([]);
      await fetchReviews();
      showToast("¡Gracias! Tu reseña ha sido guardada.", "success");
    } catch (err) {
      const msg = err?.response?.data?.error || "No se pudo guardar tu reseña";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar reseña propia
  const handleDeleteReview = async () => {
    if (!isUser || !myReviewId) return;
    const ok = window.confirm(
      "¿Eliminar tu reseña? Esta acción no se puede deshacer."
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const { data } = await apiUrl.delete(`/reviews/product/${product._id}`);
      if (data?.stats) setStats(data.stats);
      setMyText("");
      setMyRating(5);
      setMyReviewId(null);
      setFiles([]);
      await fetchReviews();
      showToast("Reseña eliminada", "success");
    } catch {
      showToast("No se pudo eliminar tu reseña", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* Destacados*/
  useEffect(() => {
    let cancel = false;
    if (!product?._id) return;

    setLoadingRecs(true);
    setRecsError("");
    setRecs({ similar: [], complementary: [], fallback: [] });

    apiUrl
      .get(`products/${product._id}/recommendations`, { params: { limit: 10 } })
      .then(({ data }) => {
        if (cancel) return;
        setRecs({
          similar: Array.isArray(data?.similar) ? data.similar : [],
          complementary: Array.isArray(data?.complementary)
            ? data.complementary
            : [],
          fallback: Array.isArray(data?.fallback) ? data.fallback : [],
        });
      })
      .catch(() => {
        if (cancel) return;
        setRecsError("No se pudieron cargar recomendaciones.");
        setRecs({ similar: [], complementary: [], fallback: [] });
      })
      .finally(() => {
        if (!cancel) setLoadingRecs(false);
      });

    return () => {
      cancel = true;
    };
  }, [product?._id]);

  const avg = Number(stats.avg || 0);

  /* ----- UI ----- */
  return (
    <div className="pd">
      <div className="pd__top">
        {/* Galería */}
        <div className="pd__media">
          <div className="pd__thumbs">
            {images.map((img, idx) => (
              <button
                key={idx}
                className={`pd__thumb ${selectedImage === img ? "active" : ""}`}
                onClick={() => setSelectedImage(img)}
                aria-label={`Imagen ${idx + 1}`}
                type="button"
              >
                <img
                  src={`${baseUrl}${img}`}
                  onError={(e) => (e.currentTarget.src = "/placeholder.jpg")}
                  alt={`mini-${idx}`}
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          <figure className="pd__figure">
            <button
              className="pd__zoomBtn"
              onClick={() =>
                openLightbox(Math.max(0, images.indexOf(selectedImage)))
              }
              aria-label="Ampliar imagen"
              type="button"
            >
              <img
                src={`${baseUrl}${selectedImage}`}
                alt={product.name}
                onError={(e) => (e.currentTarget.src = "/placeholder.jpg")}
                className="pd__mainimg"
              />
            </button>
          </figure>
        </div>

        {/* Panel derecho */}
        <aside className="pd__panel">
          <div className="pd__breadcrumbs">
            <Link to="/">Inicio</Link> <span>›</span>{" "}
            <Link to="/artesanías">Artesanías</Link>
          </div>

          <div className="pd__titleRow">
            <h1 className="pd__title">{product.name}</h1>
            <FavoriteButton productId={product?._id} className="pd__favBtn" />
          </div>

          <div className="pd__ratingRow">
            <StarRatingDisplay value={avg} />
            <span className="pd__votes">
              {stats.total} {stats.total === 1 ? "opinión" : "opiniones"}
            </span>
          </div>

          <div className="pd__price">
            <ProductPriceBlock
              price={product.price}
              effectivePrice={effectivePrice}
            />
          </div>

          <div className="pd__shipping">
            <span className="pd__free">Envío gratis</span> a todo el país
          </div>

          <div className="pd__selectors">
            <div className="pd__field">
              <label>Talla</label>
              <select
                value={selectedSize}
                onChange={(e) => {
                  setSelectedSize(e.target.value);
                  setSelectedColor("");
                }}
              >
                <option value="">Seleccionar talla</option>
                {availableSizes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedSize && (
              <div className="pd__field">
                <label>Color</label>
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                >
                  <option value="">Seleccionar color</option>
                  {getColorsForSelectedSize().map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSize && selectedColor && (
              <p className="pd__stock">
                Stock disponible: <b>{availableStock}</b>
              </p>
            )}

            <div className="pd__qty">
              <label htmlFor="qty">Cantidad</label>
              <input
                id="qty"
                type="number"
                min="1"
                max={availableStock || 1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            <div className="pd__ctaRow">
              <button
                className="btn btn--primary"
                onClick={handleAdd}
                type="button"
              >
                Agregar al carrito
              </button>
              <button
                className="btn btn--ghost"
                onClick={handleBuyNow}
                type="button"
              >
                {loadingBuyNow ? "Procesando..." : "Comprar ahora"}
              </button>
            </div>

            <button className="btn btn--link">
              <Link to="/" className="pd__back">
                ← Regresar al comercio
              </Link>
            </button>
          </div>
        </aside>
      </div>

      {/* Descripción */}
      <section className="pd__section">
        <h2>Descripción</h2>
        <div className="pd__desc">
          {product.description ? (
            <p>{product.description}</p>
          ) : (
            <p>
              Producto artesanal elaborado con técnicas tradicionales. Pronto
              agregaremos una descripción detallada.
            </p>
          )}
        </div>
      </section>

      {/* Opiniones */}
      <section className="pd__section">
        <div className="pd__reviews">
          <div className="pd__summary">
            <h3>Opiniones del producto</h3>
            <div className="pd__avg">
              <StarRatingDisplay value={avg} size="lg" />
              <div className="pd__avgnum">{avg.toFixed(1)}</div>
              <div className="pd__avglbl">{stats.total} calificaciones</div>
            </div>

            <div className="pd__bars">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = stats?.dist?.[s] || 0;
                const pct = stats.total
                  ? Math.round((count / stats.total) * 100)
                  : 0;
                return (
                  <div key={s} className="bar">
                    <span className="bar__label">{s}</span>
                    <div className="bar__track">
                      <div className="bar__fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="bar__count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pd__opinions">
            <form className="pd__form" onSubmit={handleSubmitReview}>
              <h4>
                {isUser
                  ? myReviewId
                    ? "Edita tu reseña"
                    : "Escribe tu reseña"
                  : "Inicia sesión para reseñar"}
              </h4>

              {isUser && !eligible && (
                <p className="pd__hint" style={{ color: "#b45309" }}>
                  Solo <b>compradores </b> pueden reseñar este producto.
                </p>
              )}

              <p className="pd__rateHint">
                selecciona cuántas ⭐ das al producto.
              </p>
              <StarRatingInput value={myRating} onChange={setMyRating} />

              <textarea
                placeholder="Cuéntanos tu experiencia con el producto…"
                value={myText}
                onChange={(e) => setMyText(e.target.value)}
                rows={4}
                disabled={!isUser || submitting || !eligible}
                maxLength={2000}
              />

              {/* Uploader de imágenes */}
              <div className="pd__uploader">
                <label className="btn btn--ghost">
                  Adjuntar imágenes (máx. 4)
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={onPickFiles}
                    style={{ display: "none" }}
                    disabled={!isUser || submitting || !eligible}
                  />
                </label>

                <div className="pd__previews">
                  {previews.map((src, i) => (
                    <div key={src} className="pd__thumbUp">
                      <img src={src} alt={`preview-${i}`} />
                      <button
                        type="button"
                        className="x"
                        onClick={() => removePicked(i)}
                        aria-label="Quitar"
                        disabled={submitting}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pd__formActions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!isUser || submitting || !eligible}
                >
                  {myReviewId ? "Guardar cambios" : "Guardar reseña"}
                </button>
                {myReviewId && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={handleDeleteReview}
                    disabled={submitting}
                  >
                    Eliminar mi reseña
                  </button>
                )}
                <span className="pd__hint">
                  Solo puedes tener <b>una reseña</b> por producto.
                </span>
              </div>
            </form>

            <ul className="pd__list">
              {loadingReviews ? (
                <li className="pd__empty">Cargando reseñas…</li>
              ) : reviews.length === 0 ? (
                <li className="pd__empty">
                  Aún no hay opiniones. ¡Sé el primero en opinar!
                </li>
              ) : (
                reviews.map((r) => (
                  <li key={r.id || r._id} className="op">
                    <div className="op__header">
                      <StarRatingDisplay value={r.rating} />
                      <span className="op__author">
                        {r.author || "Usuario"}
                      </span>
                      <span className="op__date">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    {r.text ? <p className="op__text">{r.text}</p> : null}

                    {Array.isArray(r.images) && r.images.length > 0 && (
                      <div className="op__imgs">
                        {r.images.map((im, idx) => (
                          <a
                            key={idx}
                            href={`${getBaseUrl()}${im.full}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={`${getBaseUrl()}${im.thumb}`}
                              alt={`foto ${idx + 1}`}
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Destacados */}
      {/* Recomendaciones */}
      <section className="pd__section">
        <h2>También te puede interesar</h2>

        {loadingRecs && <p>Cargando recomendaciones…</p>}
        {!loadingRecs && recsError && (
          <p style={{ color: "crimson" }}>{recsError}</p>
        )}

        {!loadingRecs && !recsError && (
          <>
            {/* Similares */}
            {recs.similar?.length > 0 && (
              <section className="pd__section">
                <h3>Productos similares</h3>
                <div className="pd__featured">
                  {recs.similar.slice(0, 10).map((it) => (
                    <MiniCard key={it._id} item={it} />
                  ))}
                </div>
              </section>
            )}

            {/* Complementarios / cross-sell */}
            {recs.complementary?.length > 0 && (
              <section className="pd__section">
                <h3>Combínalo con</h3>
                <div className="pd__featured">
                  {recs.complementary.slice(0, 10).map((it) => (
                    <MiniCard key={it._id} item={it} />
                  ))}
                </div>
              </section>
            )}

            {/* Fallback (tendencias/aleatorio controlado) */}
            {recs.fallback?.length > 0 && (
              <section className="pd__section">
                <h3>Te puede interesar</h3>
                <div className="pd__featured">
                  {recs.fallback.slice(0, 10).map((it) => (
                    <MiniCard key={it._id} item={it} />
                  ))}
                </div>
              </section>
            )}

            {/* Si no llegó nada del backend, usa featuredProducts como respaldo */}
            {!recs.similar?.length &&
              !recs.complementary?.length &&
              !recs.fallback?.length &&
              featuredProducts?.length > 0 && (
                <section className="pd__section">
                  <h3>Productos destacados</h3>
                  <div className="pd__featured">
                    {featuredProducts.slice(0, 10).map((it) => (
                      <MiniCard key={it._id} item={it} />
                    ))}
                  </div>
                </section>
              )}
          </>
        )}
      </section>

      {/* ============== POPUP Imagenes ============== */}
      <div
        className={`lb ${lbOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Vista ampliada de imágenes"
        onClick={closeLightbox}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          className="lb__close"
          aria-label="Cerrar"
          onClick={closeLightbox}
          type="button"
        >
          ✕
        </button>

        {images.length > 1 && (
          <>
            <button
              className="lb__nav lb__nav--prev"
              aria-label="Anterior"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              type="button"
            >
              ‹
            </button>
            <button
              className="lb__nav lb__nav--next"
              aria-label="Siguiente"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              type="button"
            >
              ›
            </button>
          </>
        )}

        <figure className="lb__stage" onClick={(e) => e.stopPropagation()}>
          <img
            src={`${baseUrl}${images[lbIndex]}`}
            alt={`imagen ${lbIndex + 1}`}
            className="lb__img"
            loading="eager"
          />
          <figcaption className="lb__counter">
            {lbIndex + 1} / {images.length}
          </figcaption>
        </figure>

        {images.length > 1 && (
          <div className="lb__thumbs" onClick={(e) => e.stopPropagation()}>
            {images.map((img, i) => (
              <button
                key={img + i}
                className={`lb__thumb ${i === lbIndex ? "active" : ""}`}
                onClick={() => setLbIndex(i)}
                type="button"
              >
                <img src={`${baseUrl}${img}`} alt={`mini ${i + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de “Comprar ahora” */}
      <CheckoutModal
        open={openBuyNow}
        onClose={() => setOpenBuyNow(false)}
        onConfirm={confirmBuyNow}
      />
      <SuccessOverlay
        open={success.open}
        humanCode={success.humanCode}
        onPrimary={() => {
          setSuccess({ open: false, humanCode: "" });
          navigate("/");
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

export default ProductDetailBlock;
