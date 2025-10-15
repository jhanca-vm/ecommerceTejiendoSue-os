import React, { useEffect, useState, useContext, useRef } from "react";

import apiUrl from "../../../api/apiClient";

import { AuthContext } from "../../../contexts/AuthContext";
import ConfirmModal from "../../../blocks/ConfirmModalBlock";
import { useToast } from "../../../contexts/ToastContext";
import { formatCOP } from "../../../utils/currency";

import { useNavigate } from "react-router-dom";

const SERVER_BASE = "http://localhost:5000";

/** Normaliza y valida que la imagen venga del backend esperado. */
const safeImageUrl = (serverBase, relPath) => {
  if (!relPath || typeof relPath !== "string") return "";
  try {
    if (!relPath.startsWith("/uploads/products/")) return "";
    return `${serverBase}${relPath}`;
  } catch {
    return "";
  }
};

/** Estado de la promo en base a fechas */
const getDiscountStatus = (discount) => {
  const d = discount || {};
  if (!d.enabled) return { label: "Inactiva", code: "inactive" };

  const now = new Date();
  const start = d.startAt ? new Date(d.startAt) : null;
  const end = d.endAt ? new Date(d.endAt) : null;

  if (start && now < start) return { label: "Programada", code: "scheduled" };
  if (end && now > end) return { label: "Caducada", code: "expired" };
  return { label: "Activa", code: "active" };
};

/** Muestra precio regular / efectivo con tachado cuando aplica */
const PriceCell = ({ price, effectivePrice }) => {
  const p = Number(price || 0);
  const e = Number(effectivePrice || 0);
  const hasDiscount = e > 0 && e < p;

  if (!p) return <span>—</span>;

  return (
    <div className="price-cell">
      {hasDiscount ? (
        <>
          <span className="price-original">{formatCOP(p)}</span>
          <span className="price-effective">{formatCOP(e)}</span>
        </>
      ) : (
        <span className="price-regular">{formatCOP(p)}</span>
      )}
    </div>
  );
};

/** Muestra detalles de la promo para admin */
const PromoCell = ({ discount }) => {
  const d = discount || {};
  const status = getDiscountStatus(d);

  const isPercent = d.type === "PERCENT";
  const valueLabel =
    typeof d.value === "number" || typeof d.value === "string"
      ? isPercent
        ? `${Number(d.value)}%`
        : formatCOP(d.value)
      : "—";

  const fmt = (iso) => {
    if (!iso) return "—";
    try {
      const dt = new Date(iso);
      return dt.toLocaleString();
    } catch {
      return "—";
    }
  };

  return (
    <div className="promo-cell">
      <div className={`promo-badge ${status.code}`}>{status.label}</div>
      <div className="promo-meta">
        <b>Tipo:</b> {d.type || "—"}
      </div>
      <div className="promo-meta">
        <b>Valor:</b> {valueLabel}
      </div>
      <div className="promo-meta">
        <b>Inicio:</b> {fmt(d.startAt)}
      </div>
      <div className="promo-meta">
        <b>Fin:</b> {fmt(d.endAt)}
      </div>
    </div>
  );
};

const AdminProductPage = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyActivePromos, setOnlyActivePromos] = useState(false);
  const [sortBy, setSortBy] = useState("name"); // name | promo | stock | price | createdAt
  const [sortDir, setSortDir] = useState("asc"); // asc | desc
  const [productToDelete, setProductToDelete] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState(null);

  const { token } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const abortRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProducts = async () => {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const res = await apiUrl.get(`products`, {
        signal: abortRef.current.signal,
      });
      setProducts(res.data || []);
    } catch (e) {
      if (apiUrl.isCancel(e)) return;
      showToast("Error al cargar productos", "error");
    }
  };

  const getTotalStock = (variants) => {
    if (!Array.isArray(variants)) return 0;
    return variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  };

  const toggleRow = (id) => {
    setExpandedProductId((prevId) => (prevId === id ? null : id));
  };

  /** Filtrado + Ordenamiento */
  const viewProducts = (() => {
    const lower = searchTerm.trim().toLowerCase();

    let arr = (products || []).filter((p) => {
      const matchName = (p.name || "").toLowerCase().includes(lower);
      const cats = Array.isArray(p.categories)
        ? p.categories
        : p.categories
        ? [p.categories]
        : [];
      const matchCategory = cats.some((cat) =>
        typeof cat === "object" && cat?.name
          ? cat.name.toLowerCase().includes(lower)
          : typeof cat === "string"
          ? cat.toLowerCase().includes(lower)
          : false
      );

      if (lower && !(matchName || matchCategory)) return false;

      if (onlyActivePromos) {
        const status = getDiscountStatus(p.discount);
        if (status.code !== "active") return false;
      }

      return true;
    });

    const cmp = (a, b) => {
      let av, bv;

      switch (sortBy) {
        case "promo": {
          // Orden: active > scheduled > inactive > expired
          const rank = { active: 3, scheduled: 2, inactive: 1, expired: 0 };
          av = rank[getDiscountStatus(a.discount).code] ?? -1;
          bv = rank[getDiscountStatus(b.discount).code] ?? -1;
          break;
        }
        case "stock":
          av = getTotalStock(a.variants);
          bv = getTotalStock(b.variants);
          break;
        case "price":
          av = Number(a.effectivePrice ?? a.price ?? 0);
          bv = Number(b.effectivePrice ?? b.price ?? 0);
          break;
        case "createdAt":
          av = new Date(a.createdAt || 0).getTime();
          bv = new Date(b.createdAt || 0).getTime();
          break;
        case "name":
        default:
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
          break;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    };

    arr.sort(cmp);
    return arr;
  })();

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await apiUrl.delete(`products/${productToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast("Producto eliminado correctamente", "success");
      fetchProducts();
    } catch (e) {
      const msg = e?.response?.data?.error || "Error al eliminar el producto";
      showToast(msg, "error");
    } finally {
      setShowConfirm(false);
      setProductToDelete(null);
    }
  };

  const handleEdit = (product) => {
    navigate(`/admin/products/edit/${product._id}`);
  };

  return (
    <div className="admin-products ao ">
      <div className="header ao__head">
        <h1>Administrar Productos</h1>
      </div>

      <div className="toolbar af">
        <input
          type="text"
          placeholder="Buscar por nombre o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          aria-label="Buscar productos"
        />

        <label className="filter-check">
          <input
            type="checkbox"
            checked={onlyActivePromos}
            onChange={(e) => setOnlyActivePromos(e.target.checked)}
          />
          Solo promos activas
        </label>

        <div className="sort-controls">
          <label>
            Ordenar por:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Nombre</option>
              <option value="promo">Estado promo</option>
              <option value="stock">Stock total</option>
              <option value="price">Precio</option>
              <option value="createdAt">Fecha creación</option>
            </select>
          </label>

          <label>
            Dirección:
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </label>
        </div>
      </div>

      <table className="product-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Promoción</th>
            <th>Stock Total</th>
            <th>Categorías</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {viewProducts.map((p) => {
            const status = getDiscountStatus(p.discount);
            const isActive = status.code === "active";

            return (
              <React.Fragment key={p._id}>
                <tr
                  className={
                    getTotalStock(p.variants) <= 0 ? "row-soldout" : ""
                  }
                >
                  <td>
                    {p.images?.[0] ? (
                      <img
                        src={safeImageUrl(SERVER_BASE, p.images[0])}
                        alt={p.name || "Producto"}
                        className="thumbnail"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <div
                        className="thumbnail placeholder"
                        aria-label="Sin imagen"
                      />
                    )}
                  </td>

                  <td>
                    <div className="name-with-badge">
                      <span>{p.name}</span>
                      {isActive && (
                        <span className="badge-offer">En oferta</span>
                      )}
                      {getTotalStock(p.variants) <= 0 && (
                        <span className="badge-soldout">Sin stock</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <PriceCell
                      price={p.price}
                      effectivePrice={p.effectivePrice}
                    />
                  </td>

                  <td>
                    <PromoCell discount={p.discount} />
                  </td>

                  <td>{getTotalStock(p.variants)}</td>

                  <td>
                    {Array.isArray(p.categories)
                      ? p.categories
                          .map((cat) =>
                            typeof cat === "object" ? cat?.name : cat
                          )
                          .filter(Boolean)
                          .join(", ")
                      : typeof p.categories === "object"
                      ? p.categories?.name || "Sin categoría"
                      : "Sin categoría"}
                  </td>

                  <td>
                    <button className="btn-edit" onClick={() => handleEdit(p)}>
                      Editar
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => {
                        setProductToDelete(p);
                        setShowConfirm(true);
                      }}
                    >
                      Eliminar
                    </button>
                    <button
                      className="btn-variants"
                      onClick={() => toggleRow(p._id)}
                    >
                      {expandedProductId === p._id
                        ? "Ocultar variantes"
                        : "Variantes"}
                    </button>
                    <button
                      className="btn-history"
                      onClick={() =>
                        navigate(`/admin/products/${p._id}/history`)
                      }
                    >
                      Historial
                    </button>
                  </td>
                </tr>

                {expandedProductId === p._id && p.variants?.length > 0 && (
                  <tr key={`expanded-${p._id}`}>
                    <td colSpan="7">
                      <table className="variant-table">
                        <thead>
                          <tr>
                            <th>Talla</th>
                            <th>Color</th>
                            <th>Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.variants.map((v, i) => (
                            <tr key={v._id || i}>
                              <td>{v.size?.label || "—"}</td>
                              <td>{v.color?.name || "—"}</td>
                              <td>{v.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {showConfirm && (
        <ConfirmModal
          title="Eliminar producto"
          message={`¿Estás seguro de eliminar "${productToDelete?.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => {
            setProductToDelete(null);
            setShowConfirm(false);
          }}
        />
      )}
    </div>
  );
};

export default AdminProductPage;
