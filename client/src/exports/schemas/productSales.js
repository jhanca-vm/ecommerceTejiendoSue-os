// src/exports/schemas/productSales.js
// Historial de ventas por producto
const productSalesSchema = {
  columns: [
    { header: "Fecha", key: "fecha", width: 40, type: "text", truncate: 32 },
    {
      header: "Color",
      key: "color",
      width: 30,
      type: "text",
      truncate: 30,
      align: "center",
    },
    {
      header: "Talla",
      key: "size",
      width: 30,
      type: "text",
      truncate: 30,
      align: "center",
    },
    {
      header: "Precio unit.",
      key: "precioUnit",
      width: 26,
      type: "number",
      align: "right",
    },
    {
      header: "Cantidad",
      key: "cantidad",
      width: 22,
      type: "number",
      align: "center",
    },
    {
      header: "Total",
      key: "total",
      width: 30,
      type: "number",
      align: "right",
    },
  ],
};

export default productSalesSchema;
