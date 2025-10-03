// src/exports/schemas/ordersReport.js

const ordersReportSchema = {
  columns: [
    { header: "Fecha",    key: "createdAt", width: 26, type: "text", align: "left", fontSize: 7.8 },
    { header: "Pedido",   key: "pedido",    width: 28, type: "text", truncate: 28, fontSize: 8},
    { header: "Email",    key: "userEmail", width: 60, type: "text", truncate: 32, fontSize: 8 },
    { header: "Producto", key: "product",   width: 40, type: "text", truncate: 32 },
    { header: "Talla",    key: "size",      width: 17, type: "text", truncate: 18, align: "center"  },
    { header: "Color",    key: "color",     width: 25, type: "text", truncate: 18 },
    { header: "Precio",   key: "unitPrice", width: 25, type: "number", align: "right" },
    { header: "Cant.",    key: "qty",       width: 18, type: "number", align: "center" },
    { header: "Estado",   key: "status",    width: 26, type: "text", truncate: 16 },
  ],
};

export default ordersReportSchema;
