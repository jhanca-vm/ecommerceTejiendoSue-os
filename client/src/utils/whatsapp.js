import { getBaseUrl } from "../api/apiClient";

/** COP sin decimales */
export const fmtCOP = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/** Precio unitario desde el item del pedido (o product poblado) */
export const unitFromOrderItem = (it) =>
  Number(
    it?.unitPrice ?? it?.product?.effectivePrice ?? it?.product?.price ?? 0
  );

/** Normaliza teléfono para wa.me */
function normalizePhone(phoneRaw) {
  return String(phoneRaw || "")
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");
}

/**
 * Construye el texto de WhatsApp para un pedido.
 * @param {Object} order 
 * @param {Object} customer 
 * @param {Object} shippingInfo
 * @param {Object} opts 
 */
export function buildWhatsAppText(order, customer, shippingInfo, opts = {}) {
  const {
    humanCode = null,
    //includeSKU = true,
    includeVariant = true,
    includeImages = false,
  } = opts;

  const baseUrl = getBaseUrl();
  const header = [];
  header.push("Nuevo pedido");
  header.push(`ID: ${humanCode || order?._id || "—"}`);

  if (customer?.name || customer?.email) {
    header.push(
      `Cliente: ${customer?.name || "N/A"} (${customer?.email || "N/A"})`
    );
  }

  if (shippingInfo) {
    header.push(
      `Envío: ${shippingInfo.fullName || "—"} | Tel: ${
        shippingInfo.phone || "—"
      }`
    );
    const addr = [shippingInfo.address, shippingInfo.city]
      .filter(Boolean)
      .join(", ");
    if (addr) header.push(addr);
    if (shippingInfo.notes) header.push(`Notas: ${shippingInfo.notes}`);
  }

  const lines = ["", "Detalle:"];
  (order?.items || []).forEach((it) => {
    const name =
      typeof it?.product === "object" && it?.product?.name
        ? it.product.name
        : it?.productName || "Producto";
    //const sku = includeSKU && it?.product?.sku ? ` [${it.product.sku}]` : "";
    const size =
      includeVariant && it?.size?.label ? ` · Talla: ${it.size.label}` : "";
    const color =
      includeVariant && it?.color?.name ? ` · Color: ${it.color.name}` : "";
    const qty = Number(it.quantity || 0);
    const line = unitFromOrderItem(it) * qty;
    lines.push(`- ${name}${size}${color} x ${qty} = ${fmtCOP(line)}`);
  });

  const subtotal =
    (order?.items || []).reduce(
      (s, it) => s + unitFromOrderItem(it) * Number(it.quantity || 0),
      0
    ) || 0;
  const shipping = Number(order?.shippingCost || 0);
  const total = Number(order?.total ?? subtotal + shipping);

  const footer = ["", `Total: ${fmtCOP(total)}`];

  // Opcional: lista de URLs de imagen principal por ítem
  const imageLines = [];
  if (includeImages) {
    const urls = [];
    for (const it of order?.items || []) {
      const p = it?.product || {};
      const rel = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
      if (rel) urls.push(`${baseUrl}${rel.startsWith("/") ? "" : "/"}${rel}`);
    }
    if (urls.length) {
      imageLines.push("", "Imágenes:");
      urls.forEach((u) => imageLines.push(u));
    }
  }

  return [
    header.join("\n"),
    lines.join("\n"),
    footer.join("\n"),
    imageLines.join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Crea la URL wa.me lista para abrir en nueva pestaña.
 * @param {string} phoneRaw 
 * @param {Object} order
 * @param {Object} customer
 * @param {Object} shippingInfo
 * @param {Object} opts
 */
export function buildWhatsAppUrl(
  phoneRaw,
  order,
  customer,
  shippingInfo,
  opts = {}
) {
  const phone = normalizePhone(phoneRaw);
  const text = buildWhatsAppText(order, customer, shippingInfo, opts);
  const encoded = encodeURIComponent(text);
  return phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
