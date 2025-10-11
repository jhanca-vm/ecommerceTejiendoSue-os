// src/pages/user/CatalogoPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import apiUrl from "../../api/apiClient";

import ProductListBlocks from "../../blocks/users/ProductListBlocks";
import CategoryHeader from "../../blocks/users/catalog/CategoryHeader";
import FiltersSidebar from "../../blocks/users/catalog/FiltersSidebar";

import SortBar from "../../blocks/users/catalog/SortBar";
import { color } from "framer-motion";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function CatalogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams(); // puede venir slug desde /categoria/:slug o /artesanias/:slug
  const query = useQuery();

  const urlCategory = useMemo(() => {
    // Soporta /categoria/:slug, /artesanias/:slug, /cafe/:slug, /panela/:slug
    const firstSeg = location.pathname.split("/").filter(Boolean)[0] || "";
    if (["categoria", "artesanias", "cafe", "panela"].includes(firstSeg)) {
      return params.slug || null;
    }
    // fallback: ?category=slug
    const qCat = query.get("category");
    return qCat || null;
  }, [location.pathname, params.slug, query]);

  const [data, setData] = useState([]);
  const [facets, setFacets] = useState({ sizes: [], colors: [] });
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 24 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryInfo, setCategoryInfo] = useState(null);

  const page = Number(query.get("page") || 1);
  const limit = Number(query.get("limit") || 24);
  const sort = query.get("sort") || "relevance";
  const onSale = query.get("onSale") === "1" ? 1 : 0;
  const inStock = query.get("inStock") === "1" ? 1 : 0;
  const q = query.get("q") || "";

  // Cargar info de categoría (si hay slug)
  useEffect(() => {
    let mounted = true;
    if (!urlCategory) {
      setCategoryInfo(null);
      return;
    }
    apiUrl
      .get(`categories/slug/${urlCategory}`)
      .then((res) => {
        if (mounted) setCategoryInfo(res.data || null);
      })
      .catch(() => {
        if (mounted) setCategoryInfo(null);
      });
    return () => {
      mounted = false;
    };
  }, [urlCategory]);

  // Cargar productos (search)
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = {
      page,
      limit,
      sort,
      onSale: onSale ? 1 : 0,
      inStock: inStock ? 1 : 0,
    };
    if (q) params.q = q;
    if (urlCategory) params.category = urlCategory;

    apiUrl
      .get("products/search", { params })
      .then((res) => {
        if (!mounted) return;
        const {
          data: rows = [],
          total = 0,
          facets: fa = {},
          page: p = 1,
          limit: l = 24,
        } = res.data || {};
        setData(rows);
        setFacets({ sizes: fa.sizes || [], colors: fa.colors || [] });
        setMeta({ total, page: p, limit: l });
        setError("");
      })
      .catch(() => {
        if (mounted) setError("Error al cargar productos");
      })
      .finally(() => mounted && setLoading(false));
  }, [page, limit, sort, onSale, inStock, q, urlCategory]);

  const setQuery = (patch) => {
    const sp = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") sp.delete(k);
      else sp.set(k, String(v));
    });
    navigate(
      { pathname: location.pathname, search: `?${sp.toString()}` },
      { replace: false }
    );
  };

  const onChangeSort = (value) => setQuery({ sort: value, page: 1 });
  const onToggleOnSale = () => setQuery({ onSale: onSale ? 0 : 1, page: 1 });
  const onToggleInStock = () => setQuery({ inStock: inStock ? 0 : 1, page: 1 });
  const onChangePage = (p) => setQuery({ page: p });

  return (
    <div className="catalog-page">
      <aside>
        <FiltersSidebar
          onSale={!!onSale}
          inStock={!!inStock}
          onToggleOnSale={onToggleOnSale}
          onToggleInStock={onToggleInStock}
          sizesFacet={facets.sizes}
          colorsFacet={facets.colors}
        />
      </aside>

      <main className="catalog-main">
        <CategoryHeader
          category={categoryInfo}
          slug={urlCategory}
          total={meta.total}
          q={q}
        />

        <SortBar sort={sort} total={meta.total} onChangeSort={onChangeSort} />

        {loading && <p>Cargando…</p>}
        {error && <p style={{ color: "crimson" }}>{error}</p>}

        {!loading && !error && (
          <>
            {data.length === 0 ? (
              <p>No se encontraron productos.</p>
            ) : (
              <div className="products-grid">
                {data.map((p) => (
                  <ProductListBlocks key={p._id} product={p} />
                ))}
              </div>
            )}

            {meta.total > meta.limit && (
              <div className="pagination">
                {Array.from(
                  { length: Math.ceil(meta.total / meta.limit) },
                  (_, i) => i + 1
                ).map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangePage(p)}
                    disabled={p === meta.page}
                    className={p === meta.page ? "active" : ""}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
