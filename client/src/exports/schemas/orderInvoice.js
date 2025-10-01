// src/exports/schemas/orderInvoice.js
const orderInvoiceSchema = {
  columns: [
    { header: "Producto",  key: "product",   width: 58, type: "text",  truncate: 46 },
    { header: "Talla",     key: "size",   width: 25, type: "text",  truncate: 24, align: "center" }, 
    { header: "Color",     key: "color",   width: 25, type: "text",  truncate: 24, align: "center" }, 
    { header: "Cantidad",  key: "qty",       width: 25, type: "number", align: "center" },
    { header: "Precio",    key: "price",     width: 28, type: "number", align: "right" },
    { header: "Subtotal",  key: "subtotal",  width: 30, type: "number", align: "right" },
  ],
};

export default orderInvoiceSchema;
