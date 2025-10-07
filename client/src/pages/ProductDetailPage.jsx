// pages/ProductDetailPage.jsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useContext } from "react";
import apiUrl from "../api/apiClient";
import ProductDetailBlock from "../blocks/users/ProductDetailBlock";
import { CartContext } from "../contexts/CartContext";

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    let mounted = true;
    setError("");
    setProduct(null);
    apiUrl
      .get(`products/${id}`)
      .then((res) => mounted && setProduct(res.data))
      .catch((err) => {
        if (!mounted) return;
        const status = err?.response?.status;
        if (status === 404) setError("Este producto no está disponible.");
        else setError("No se pudo cargar el producto.");
      });
    return () => { mounted = false; };
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h2>{error}</h2>
        <p>
          <Link to="/tienda">Volver a la tienda</Link>
        </p>
      </div>
    );
  }

  if (!product) return <p style={{ padding: 24 }}>Cargando producto...</p>;

  return (
    <ProductDetailBlock
      product={product}
      onAddToCart={(item, qty) => addToCart(item, qty)}
    />
  );
};

export default ProductDetail;

