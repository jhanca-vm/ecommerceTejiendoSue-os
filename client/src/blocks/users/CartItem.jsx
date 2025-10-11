// src/blocks/users/CartItem.jsx
import { getBaseUrl } from "../../api/apiClient";

const CartItem = ({ item, removeFromCart, updateItem }) => {
  const { product, quantity, size, color } = item;
  const baseUrl = getBaseUrl();

  const handleChange = (e) => {
    const newQty = Number(e.target.value);
    if (newQty >= 1) {
      updateItem(product?._id, size?._id ?? null, color?._id ?? null, newQty);
    }
  };

  const price = Number(
    typeof product?.effectivePrice !== "undefined"
      ? product.effectivePrice
      : product?.price || 0
  );

  const sizeLabel = size?.label ?? size?.name ?? "Única";
  const colorName = color?.name ?? color?.label ?? "—";

  const imgSrc = product?.images?.[0]
    ? `${baseUrl}${product.images[0]}`
    : "/placeholder.jpg";

  return (
    <div className="cart-item">
      <img
        src={imgSrc}
        alt={product?.name ?? "Producto"}
        className="cart-image"
        onError={(e) => (e.currentTarget.src = "/placeholder.jpg")}
      />
      <div className="cart-info">
        <h4>{product?.name ?? "Producto"}</h4>
        <p>Precio unitario: ${price}</p>
        <p>Talla: {sizeLabel}</p>
        <p>Color: {colorName}</p>

        <label htmlFor={`qty-${product?._id}`}>Cantidad:</label>
        <input
          id={`qty-${product?._id}`}
          type="number"
          value={quantity}
          min={1}
          onChange={handleChange}
        />
        <p>
          <strong>Total: ${price * (Number(quantity) || 0)}</strong>
        </p>
      </div>
      <button
        className="cart-remove"
        onClick={() =>
          removeFromCart(product?._id, size?._id ?? null, color?._id ?? null)
        }
      >
        Quitar
      </button>
    </div>
  );
};

export default CartItem;
