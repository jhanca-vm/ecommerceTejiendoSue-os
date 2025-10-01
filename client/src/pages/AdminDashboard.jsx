// src/pages/AdminDashboard
import { useEffect, useMemo, useState, useContext } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import apiUrl from "../api/apiClient";

import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import FilterExportControls from "../blocks/admin/FilterExportControls";
import OrderCardBlock from "../blocks/admin/OrderCardBlock";
import { formatCOP } from "../utils/currency";

// importes para pdf
import { generatePdf } from "../exports/pdfReportEngine";
import ordersReportSchema from "../exports/schemas/ordersReport";
import dayjs from "dayjs";
import logo from "../assets/manos.png";

const AdminOrdersPage = ({ statusFilterProp = "pendiente" }) => {
  const { token } = useContext(AuthContext);
  const { showToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(statusFilterProp);
  const [searchFilter, setSearchFilter] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [dateError, setDateError] = useState("");

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = () => {
    setLoading(true);
    apiUrl
      .get("orders", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setOrders(res.data))
      .catch((err) => console.error("Error al obtener pedidos:", err))
      .finally(() => setLoading(false));
  };

  const handleStatusChange = (id, status) => {
    return apiUrl
      .patch(
        `orders/${id}/status`,
        { status },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then(() => {
        fetchOrders();
        showToast(`Estado actualizado a “${status}”`, "success");
      })
      .catch((err) => {
        console.error(
          "Error al actualizar estado:",
          err?.response?.data || err.message
        );
        showToast("No se pudo actualizar el estado", "error");
        throw err;
      });
  };

  const handleCancel = (id) => {
    return apiUrl
      .post(
        `orders/${id}/cancel`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then(() => {
        fetchOrders();
        showToast("Pedido cancelado y stock restablecido", "info");
      })
      .catch((err) => {
        console.error(
          "Error al cancelar pedido:",
          err?.response?.data || err.message
        );
        showToast("No se pudo cancelar el pedido", "error");
        throw err;
      });
  };

  const validateDateRange = (from, to) => {
    if (from && !to) return "Seleccione también una fecha de fin (Hasta).";
    if (!from && to) return "Seleccione también una fecha de inicio (Desde).";
    if (from && to && dayjs(to).isBefore(dayjs(from)))
      return "La fecha Hasta no puede ser anterior a la fecha Desde.";
    return "";
  };

  useEffect(() => {
    setDateError(validateDateRange(dateRange.from, dateRange.to));
  }, [dateRange]);

  const filteredOrders = useMemo(() => {
    const isValid = dateError === "";
    return orders.filter((order) => {
      const search = searchFilter.trim().toLowerCase();
      const matchSearch =
        !search ||
        order._id.toLowerCase().includes(search) ||
        order.user?.email?.toLowerCase().includes(search) ||
        order.user?.name?.toLowerCase().includes(search) ||
        (order.items || []).some(
          (it) =>
            it?.product?.name?.toLowerCase?.().includes(search) ||
            it?.product?.sku?.toLowerCase?.().includes(search)
        );

      const matchStatus =
        statusFilter === "todos" || order.status === statusFilter;

      const matchDate = isValid
        ? (!dateRange.from ||
            dayjs(order.createdAt).isAfter(
              dayjs(dateRange.from).startOf("day")
            )) &&
          (!dateRange.to ||
            dayjs(order.createdAt).isBefore(dayjs(dateRange.to).endOf("day")))
        : true;

      return matchSearch && matchStatus && matchDate;
    });
  }, [orders, searchFilter, statusFilter, dateRange, dateError]);

  // Helper para unit price
  const getUnit = (item) =>
    Number(
      item?.unitPrice ??
        item?.product?.effectivePrice ??
        item?.product?.price ??
        0
    );

  // Exportar PDF
  const exportToPDF = () => {
    if (dateError) return alert(dateError);

    // 1) Normalizar datos -> contrato esperado por el esquema
    const rows = filteredOrders.flatMap((order) =>
      (order.items || []).map((item) => ({
        createdAt: dayjs(order.createdAt).format("YYYY-MM-DD HH:mm"),
        pedido: `${order._id.slice(-8).toUpperCase()}` || "N/A",
        userEmail: order.user?.email || "N/A",
        product: item.product?.name || "Eliminado",
        size: item.size?.label || "-",
        color: item.color?.name || "-",
        qty: String(item.quantity ?? 0),
        unitPrice: String(
          formatCOP(
            Number(
              item?.unitPrice ??
                item?.product?.effectivePrice ??
                item?.product?.price ??
                0
            )
          )
        ),
        total: String(formatCOP(Number(order.total ?? 0))),
        status: order.status || "",
      }))
    );

    // 2) Meta (encabezado y footer estándar)
    const friendlyName = (searchFilter || statusFilter || "todos").replace(
      /\s+/g,
      "_"
    );
    const today = dayjs().format("YYYY-MM-DD");

    const meta = {
      reportName: "Reporte de Pedidos",
      ecommerceName: "Tejiendo Sueños",
      printedAt: new Date(),
      timezoneLabel: "Sandoná/Nariño",
      otrosDatos:
        "Dirección: Sandoná, Nariño\nTeléfono: +57 3xx xxx xxxx\nEmail: contacto@tejiendosuenos.co",
      logo,
      fileName: `pedidos_${friendlyName}_${today}.pdf`,
    };

    // 3) Theme opcional (si quieres retocar colores globales)
    const theme = {};

    // 4) Generar PDF (portrait) con límite de 10 filas
    generatePdf({
      schema: ordersReportSchema,
      rows,
      meta,
      theme,
    });
  };

  const exportToExcel = () => {
    if (dateError) return alert(dateError);

    const rows = filteredOrders.flatMap((order) =>
      (order.items || []).map((item) => ({
        ID: order._id,
        Usuario: order.user?.email || "N/A",
        Creado: dayjs(order.createdAt).format("YYYY-MM-DD HH:mm"),
        "Fecha estado actual": dayjs(
          order.currentStatusAt || order.updatedAt
        ).format("YYYY-MM-DD HH:mm"), // <-- nuevo campo
        Producto: item.product?.name || "Eliminado",
        Talla: item.size?.label || "-",
        Color: item.color?.name || "-",
        Cantidad: item.quantity,
        "Precio Unitario": getUnit(item),
        Total: Number(order.total ?? 0),
        Estado: order.status,
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");

    const excelBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });

    const friendlyName = (searchFilter || statusFilter || "todos").replace(
      /\s+/g,
      "_"
    );
    const today = dayjs().format("YYYY-MM-DD");
    saveAs(data, `pedidos_${friendlyName}_${today}.xlsx`);
  };

  const hasResults = filteredOrders.length > 0;

  return (
    <div className="ao">
      <header className="ao__head">
        <h1>Gestión de Pedidos </h1>
      </header>

      {dateError && <div className="ao__alert">{dateError}</div>}

      <FilterExportControls
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        exportToPDF={exportToPDF}
        exportToExcel={exportToExcel}
        dateError={dateError}
        hasResults={hasResults}
      />

      {loading ? (
        <div className="ao__skeleton">
          <div className="srow" />
          <div className="srow" />
          <div className="srow" />
        </div>
      ) : !hasResults ? (
        <div className="ao__empty">
          <div className="ao__icon" aria-hidden />
          <h3>No hay pedidos con esos filtros</h3>
          <p>Ajusta los criterios o limpia los filtros para ver resultados.</p>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setStatusFilter("todos");
              setSearchFilter("");
              setDateRange({ from: "", to: "" });
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="ao__list">
          {filteredOrders.map((order) => (
            <OrderCardBlock
              key={order._id}
              order={order}
              onStatusChange={handleStatusChange}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
