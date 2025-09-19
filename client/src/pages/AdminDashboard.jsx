import { useEffect, useMemo, useState, useContext } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

import apiUrl from "../api/apiClient";

import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import FilterExportControls from "../blocks/admin/FilterExportControls";
import OrderCardBlock from "../blocks/admin/OrderCardBlock";
import { formatCOP } from "../utils/currency";

import logo from "../assets/PPFINAL.png";

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

  const exportToPDF = () => {
    if (dateError) return alert(dateError);

    const doc = new jsPDF("landscape");
    doc.addImage(logo, "PNG", 14, 10, 30, 15);
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text("Reporte de Pedidos", 14, 30);
    doc.line(14, 32, 285, 32);

    const rows = filteredOrders.flatMap((order) =>
      (order.items || []).map((item) => [
        order.user?.name || "N/A",
        order.user?.email || "N/A",
        dayjs(order.createdAt).format("YYYY-MM-DD HH:mm"),
        item.product?.name || "Eliminado",
        item.size?.label || "-",
        item.color?.name || "-",
        item.quantity,
        formatCOP(getUnit(item)),
        formatCOP(order.total ?? 0),
        order.status,
      ])
    );

    autoTable(doc, {
      startY: 36,
      head: [
        [
          "Usuario",
          "Email",
          "Fecha",
          "Producto",
          "Talla",
          "Color",
          "Cantidad",
          "Precio",
          "Total",
          "Estado",
        ],
      ],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: {
        fillColor: [122, 62, 21],
        textColor: 255,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 },
      },
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(10);
        doc.text(
          `Página ${doc.internal.getNumberOfPages()}`,
          data.settings.margin.left,
          pageHeight - 10
        );
      },
    });

    const friendlyName = (searchFilter || statusFilter || "todos").replace(
      /\s+/g,
      "_"
    );
    const today = dayjs().format("YYYY-MM-DD");
    doc.save(`pedidos_${friendlyName}_${today}.pdf`);
  };

  const exportToExcel = () => {
    if (dateError) return alert(dateError);

    const rows = filteredOrders.flatMap((order) =>
      (order.items || []).map((item) => ({
        ID: order._id,
        Usuario: order.user?.email || "N/A",
        Fecha: dayjs(order.createdAt).format("YYYY-MM-DD HH:mm"),
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
