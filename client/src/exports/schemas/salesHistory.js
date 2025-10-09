// src/exports/schemas/salesHistory.js
const salesHistorySchema = {
  columns: [
    { header: "Fecha/Hora",   key: "date",      width: 34,  type: "text", align: "left", fontSize: 8},
    { header: "Usuario",      key: "user",      width: 40,  truncate: 28 },
    { header: "Producto",     key: "product",   width: 40,  truncate: 46 },
    { header: "Variante T/C",     key: "variant",   width: 28,  truncate: 22 },
    { header: "Precio",       key: "unitPrice", width: 26,  type: "number", align: "right", fontSize: 7.8 },
    { header: "Cant.",        key: "qty",       width: 18,  type: "number", align: "center",  },
    { header: "Total",        key: "total",     width: 30,  type: "number", align: "right", fontSize: 7.8 },
    { header: "Stock cierre", key: "stock",     width: 22,  type: "number", align: "center" },
    { header: "Estado",       key: "status",    width: 26,  truncate: 16, fontSize: 8 },
  ],
};

export default salesHistorySchema;
