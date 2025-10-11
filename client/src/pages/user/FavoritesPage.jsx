// src/pages/user/FavoritesPage.jsx
import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import api from "../../api/apiClient";
import { useToast } from "../../contexts/ToastContext";
import ProductListBlocks from "../../blocks/users/ProductListBlocks";

export default function FavoritesPage() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      setLoading(true);

      if (!user) {
        if (!cancel) {
          setItems([]);
          setLoading(false);
        }
        showToast("Inicia sesión para ver tus favoritos", "info");
        return;
      }
      if (user.role !== "user") {
        if (!cancel) {
          setItems([]);
          setLoading(false);
        }
        showToast("Solo usuarios pueden ver favoritos", "warning");
        return;
      }

      try {
        // 1) Intento con populate=1
        const { data } = await api.get("favorites", { params: { populate: 1 } });
        const products = Array.isArray(data?.products) ? data.products : [];

        if (products.length > 0) {
          if (!cancel) {
            setItems(products);
            setLoading(false);
            console.log("[FavoritesPage] populate=1 ->", products.length);
          }
          return;
        }

        // 2) Fallback: trae solo IDs
        const idsRes = await api.get("favorites", { params: { populate: 0 } });
        const ids = Array.isArray(idsRes?.data?.productIds) ? idsRes.data.productIds : [];

        console.log("[FavoritesPage] populate=1 vacío; fallback ids:", ids.length);

        if (ids.length === 0) {
          if (!cancel) {
            setItems([]);
            setLoading(false);
          }
          return;
        }

        // 3) Fallback: obtiene detalles con /products/bulk
        //   Acepta ?ids=..., o ids[]=...; tu server ya normaliza (lo vimos).
        const bulk = await api.get("products/bulk", { params: { ids } });
        const bulkProducts = Array.isArray(bulk?.data?.products)
          ? bulk.data.products
          : Array.isArray(bulk?.data)
          ? bulk.data
          : [];

        if (!cancel) {
          setItems(bulkProducts);
          setLoading(false);
          console.log("[FavoritesPage] bulk ->", bulkProducts.length);
        }
      } catch (e) {
        if (!cancel) {
          setItems([]);
          setLoading(false);
        }
        showToast("No se pudieron cargar favoritos", "error");
      }
    };

    load();
    return () => {
      cancel = true;
    };
  }, [user, showToast]);

  if (loading) {
    return (
      <section className="favorites-page">
        <h1>Mis Favoritos</h1>
        <p>Cargando…</p>
      </section>
    );
  }

  return (
    <section className="favorites-page ao">
      <h1>Mis Favoritos</h1>
      {items.length === 0 ? (
        <p>No tienes productos en favoritos.</p>
      ) : (
        <div className="product-grid">
          {items.map((p) => (
            <ProductListBlocks key={p._id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
