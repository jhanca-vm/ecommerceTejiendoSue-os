import { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import apiUrl from "../api/apiClient";
import ProductListBlocks from "../blocks/users/ProductListBlocks";
import HeroBlock from "../blocks/users/HeroBlock";
import { AuthContext } from "../contexts/AuthContext";

/* ---------- Carrusel centrado: 5 por vista, máx 10 por sección ---------- */
const Section = ({ title, items = [], toMore }) => {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const data = (items || []).slice(0, 10); // límite duro 10

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    const eps = 2;
    setAtStart(el.scrollLeft <= eps);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - eps);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();

    el.addEventListener("scroll", updateArrows, { passive: true });
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateArrows);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, [data.length]);

  const scrollByDir = (dir) => {
    const vp = viewportRef.current;
    const el = trackRef.current;
    if (!vp || !el) return;
    const step = Math.round(vp.clientWidth); // desplaza exactamente un viewport (≈5 cards)
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (!data.length) return null;

  return (
    <section className="hc-section">
      <div className="hc-head">
        <h3 className="hc-title">{title}</h3>
        {toMore && (
          <Link to={toMore} className="hc-more">
            Ver más →
          </Link>
        )}
      </div>

      <div className="hc-viewport" ref={viewportRef}>
        <button
          type="button"
          className="hc-arrow hc-arrow--left"
          onClick={() => scrollByDir(-1)}
          aria-label="Anterior"
          disabled={atStart}
        >
          ‹
        </button>

        <div className="hc-track" ref={trackRef}>
          {data.map((p) => (
            <div className="hc-item" key={p._id}>
              <ProductListBlocks product={p} />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="hc-arrow hc-arrow--right"
          onClick={() => scrollByDir(1)}
          aria-label="Siguiente"
          disabled={atEnd}
        >
          ›
        </button>
      </div>
    </section>
  );
};
/* ----------------------------------------------------------------------- */

export default function ProductList() {
  const [sections, setSections] = useState({
    onSale: [],
    bestSellers: [],
    newArrivals: [],
    trending: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === "admin") return;
    let mounted = true;
    setLoading(true);

    apiUrl
      .get("products/sections", { params: { limit: 10 } }) 
      .then((res) => {
        if (!mounted) return;
        setSections(res.data || {});
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        setError("Error al cargar secciones");
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [user]);

  if (user?.role === "admin") {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <h2>Acceso restringido</h2>
        <p>
          Los administradores no pueden visualizar el catálogo de productos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <HeroBlock
        onPrimaryClick={() => navigate("/tienda")}
        onSecondaryClick={() => navigate("/nosotros")}
      />

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>
        Catálogo de Artesanías
      </h2>

      {loading && <p style={{ textAlign: "center" }}>Cargando…</p>}
      {error && (
        <p style={{ textAlign: "center", color: "crimson" }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          <Section
            title="En promoción"
            items={sections.onSale}
            toMore="/tienda?onSale=1&sort=discount_desc"
          />
          <Section
            title="Más vendidos"
            items={sections.bestSellers}
            toMore="/tienda?sort=best_sellers"
          />
          <Section
            title="Novedades"
            items={sections.newArrivals}
            toMore="/tienda?sort=newest"
          />
          {sections.trending?.length > 0 && (
            <Section
              title="Tendencias"
              items={sections.trending}
              toMore="/tienda?sort=trending"
            />
          )}
        </>
      )}
    </div>
  );
}
