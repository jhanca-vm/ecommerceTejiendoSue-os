// src/exports/schemas/productLedger.js
// Libro mayor por variante (stock/estado)
const productLedgerSchema = {
  columns: [
    { header: "Fecha", key: "fecha", width: 30, type: "text", truncate: 32 },
    { header: "Evento", key: "evento", width: 50, type: "text", truncate: 20 },
    {
      header: "Talla",
      key: "size",
      width: 20,
      type: "text",
      truncate: 46,
      align: "center",
    },
    {
      header: "Color",
      key: "color",
      width: 20,
      type: "text",
      truncate: 46,
      align: "center",
    },
    {
      header: "Stock previo",
      key: "prev",
      width: 20,
      type: "number",
      align: "right",
    },
    {
      header: "Stock nuevo",
      key: "nuevo",
      width: 25,
      type: "number",
      align: "right",
    },
    { header: "Estado", key: "estado", width: 30, type: "text", truncate: 18 },
    {
      header: "Precio",
      key: "precio",
      width: 30,
      type: "number",
      align: "right",
    },
    { header: "Nota", key: "nota", width: 50, type: "text", truncate: 80 },
  ],
};

export default productLedgerSchema;
