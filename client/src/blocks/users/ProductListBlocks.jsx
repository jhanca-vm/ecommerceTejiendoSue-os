import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

import ProductPrice from "../ProductPrice";
import FavoriteButton from "./FavoriteButton";

import { getBaseUrl } from "../../api/apiClient";

/** === Fallback defensivo de precio efectivo (si backend no lo trae) === */
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

const percentOff = (price, effectivePrice, discount) => {
  if (!price || !effectivePrice || effectivePrice >= price) return 0;
  if (discount?.type === "PERCENT")
    return Math.round(Number(discount.value || 0));
  return Math.round(100 - (effectivePrice / price) * 100);
};

const ProductListBlocks = ({ product, onAddToCart }) => {
  const navigate = useNavigate();

  const baseUrl = getBaseUrl();

  const mainImage = product?.images?.[0] || "/placeholder.jpg";
  const effectivePrice =
    typeof product?.effectivePrice !== "undefined"
      ? product.effectivePrice
      : computeEffectiveFallback(product);

  const off = useMemo(
    () =>
      percentOff(
        Number(product?.price),
        Number(effectivePrice),
        product?.discount
      ),
    [product?.price, effectivePrice, product?.discount]
  );

  const categoryLabel =
    product?.category?.name ||
    product?.categoryName ||
    product?.categoryLabel ||
    (product?.category && typeof product.category === "string"
      ? product.category
      : "");

  const detailHref = `/product/${product?._id}`;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onAddToCart === "function") {
      onAddToCart(product);
    } else {
      // Si el add directo necesita variantes, mejor llevar al detalle
      navigate(detailHref);
    }
  };

  return (
    <article className="plb" role="group" aria-label={product?.name}>
      <div className="plb__media">

        {off > 0 && <span className="plb__badge">-{off}%</span>}

        {typeof product.totalStock === "number" && product.totalStock <= 0 && (
          <span className="plb__badge plb__badge--soldout">Agotado</span>
        )}

        {/* ❤️ Botón real conectado al contexto (guest/local + user/backend) */}
        <FavoriteButton productId={product?._id} className="plb__fav" />

        <Link
          to={detailHref}
          className="plb__imageLink"
          aria-label={`Ver ${product?.name}`}
        >
          <img
            src={`${baseUrl}${mainImage}`}
            alt={product?.name || "Producto artesanal"}
            className="plb__image"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.jpg";
            }}
          />
        </Link>
      </div>

      <div className="plb__body">
        <div className="plb__meta">
          {categoryLabel ? (
            <span className="plb__chip">{categoryLabel}</span>
          ) : (
            <span />
          )}
          {(product?.rating || product?.reviewsCount) && (
            <span className="plb__rating" title="Valoración">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 17.3l-6.18 3.73L7 14.25 2 9.97l6.91-1.01L12 3l3.09 5.96L22 9.97l-5 4.28 1.18 6.78z" />
              </svg>
              <b>{Number(product?.rating || 0).toFixed(1)}</b>
              {product?.reviewsCount ? (
                <span className="plb__reviews">({product.reviewsCount})</span>
              ) : null}
            </span>
          )}
        </div>

        <Link to={detailHref} className="plb__title">
          {product?.name}
        </Link>

        <div className="plb__priceRow">
          <ProductPrice
            price={product?.price}
            effectivePrice={effectivePrice}
            className="plb-price"
          />
        </div>

        <button className="plb__cta" onClick={handleAdd} type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4h-2l-1 2v2h2l3.6 7.59L8.24 18H19v-2H9.42l1.1-2h6.45a2 2 0 0 0 1.79-1.11L21 7H6.21l-.94-2H3" />
          </svg>
          Agregar al Carrito
        </button>
      </div>
    </article>
  );
};

export default ProductListBlocks;
