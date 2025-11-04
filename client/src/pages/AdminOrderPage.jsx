// src/pages/AdminOrderPage
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import apiUrl from "../api/apiClient";
import { formatCOP } from "../utils/currency";

// importes para pdf
import { generatePdf } from "../exports/pdfReportEngine";
import salesHistorySchema from "../exports/schemas/salesHistory";
import dayjs from "dayjs";
import logo from "../assets/manos.png";


const AdminSalesHistoryPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState(""); // YYYY-MM

  // Error de fechas para rango manual
  const [dateError, setDateError] = useState("");

  // Ref para debounce (fechas)
  const debounceRef = useRef(null);

  // --- Helpers de fecha ---
  const validateDateRange = (fromStr, toStr) => {
    if (!fromStr || !toStr) return ""; // solo valida si ambas están
    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return "Fechas inválidas.";
    }
    if (toDate < fromDate) {
      return "La fecha 'Hasta' no puede ser anterior a la fecha 'Desde'.";
    }
    return "";
  };

  // Inclusivo: envía día siguiente al backend
  const normalizeToInclusive = (toStr) => {
    if (!toStr) return "";
    const d = new Date(`${toStr}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  // Convierte "YYYY-MM" a inicio/fin de mes
  const monthToRange = (mStr) => {
    if (!mStr) return { from: "", toDisplay: "", toForApi: "" };
    const [yStr, mmStr] = mStr.split("-");
    const y = Number(yStr);
    const m = Number(mmStr); // 1..12
    if (!y || !m) return { from: "", toDisplay: "", toForApi: "" };

    const monthStart = `${yStr}-${mmStr}-01`;
    const lastDay = new Date(y, m, 0).getDate(); // último día del mes
    const monthEnd = `${yStr}-${mmStr}-${String(lastDay).padStart(2, "0")}`;
    const toForApi = normalizeToInclusive(monthEnd);

    return { from: monthStart, toDisplay: monthEnd, toForApi };
  };

  // --- Carga desde API ---
  const fetchData = async (opts = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.from) params.append("from", opts.from);
      if (opts.to) params.append("to", opts.to);
      if (opts.status) params.append("status", opts.status);

      const res = await apiUrl.get(
        `/orders/sales-history?${params.toString()}`
      );
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      alert("Error al cargar historial general de ventas.");
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    fetchData({});
  }, []);

  // Validación de fechas (si NO hay mes seleccionado)
  useEffect(() => {
    if (month) {
      setDateError("");
      return;
    }
    setDateError(validateDateRange(from, to));
  }, [from, to, month]);

  // Aplica filtros ahora (prioridad mes > rango manual)
  const applyFiltersNow = (overrides = {}) => {
    const effMonth = overrides.month ?? month;

    if (effMonth) {
      const { from: mFrom, toForApi: mTo } = monthToRange(effMonth);
      fetchData({
        from: mFrom || "",
        to: mTo || "",
        status: overrides.status ?? status,
      });
      return;
    }

    const f = overrides.from ?? from;
    const t = overrides.to ?? to;
    const err = validateDateRange(f, t);
    setDateError(err);
    if (err) return;

    const toForApi = t ? normalizeToInclusive(t) : "";
    fetchData({
      from: f || "",
      to: toForApi || "",
      status: overrides.status ?? status,
    });
  };

  // Debounce para onChange de fechas
  const applyFiltersDebounced = (overrides = {}) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyFiltersNow(overrides);
    }, 400);
  };

  // Enter = aplicar inmediatamente
  const handleKeyDownApply = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      applyFiltersNow({});
    }
  };

  // Reset filtros
  const handleClearFilters = () => {
    setFrom("");
    setTo("");
    setStatus("");
    setMonth("");
    setDateError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchData({});
  };

  const toLocal = (d) => (d ? new Date(d).toLocaleString() : "");

  // Sumatorios + conteos (total vendido, unidades, pedidos únicos, clientes únicos)
  const aggregates = useMemo(() => {
    let sumTotal = 0;
    let sumQty = 0;

    const orderIds = new Set();
    const clientIds = new Set();

    for (const r of rows) {
      // Totales
      const totalNum =
        typeof r.total === "number" ? r.total : Number(r.total || 0);
      const qtyNum =
        typeof r.quantity === "number" ? r.quantity : Number(r.quantity || 0);

      sumTotal += isNaN(totalNum) ? 0 : totalNum;
      sumQty += isNaN(qtyNum) ? 0 : qtyNum;

      // Pedidos únicos
      if (r.orderId) orderIds.add(String(r.orderId));

      // Cliente único: prioriza userId, luego email, luego nombre
      const clientKey = r.userId ?? r.userEmail ?? r.userName;
      if (clientKey) clientIds.add(String(clientKey));
    }

    return {
      sumTotal, // dinero vendido (número)
      sumQty, // unidades vendidas (número)
      totalOrders: orderIds.size, // # de pedidos
      totalClients: clientIds.size, // # de clientes
    };
  }, [rows]);

  // ======= Export PDF (COP) =======
  const exportPDF = () => {
    // valida solo si aplicas rango manual (tu lógica actual)
    if (!month && dateError) {
      alert(dateError);
      return;
    }

    try {
      // 1) Normalizar filas para el schema genérico
      const normalizedRows = (rows || []).map((r) => {
        const unitPriceNum =
          typeof r.unitPrice === "number"
            ? r.unitPrice
            : Number(r.unitPrice || 0);
        const totalNum =
          typeof r.total === "number" ? r.total : Number(r.total || 0);

        return {
          date: toLocal(r.date),
          user: r.userName || "Desconocido",
          product: r.productName || "Producto eliminado",
          variant: `${r.sizeLabel || "?"} / ${r.colorName || "?"}`,
          unitPrice: formatCOP(unitPriceNum),
          qty: String(r.quantity ?? 0),
          total: formatCOP(totalNum),
          stock:
            typeof r.stockAtPurchase === "number"
              ? String(r.stockAtPurchase)
              : String(r.stockAtPurchase ?? "-"),
          status: r.status || "",
        };
      });

      // 2) Total vendido
      const sumTotalNumber = (rows || []).reduce((acc, r) => {
        const n = typeof r.total === "number" ? r.total : Number(r.total || 0);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);

      // 3) Panel de parámetros usando los estados de ESTE componente
      let clientPanelLines = [];
      if (month) {
        const { from: mFrom, toDisplay: mTo } = monthToRange(month);
        clientPanelLines.push(`Mes: ${month}`);
        if (mFrom) clientPanelLines.push(`Desde: ${mFrom}`);
        if (mTo) clientPanelLines.push(`Hasta: ${mTo}`);
      } else {
        if (from)
          clientPanelLines.push(`Desde: ${dayjs(from).format("YYYY-MM-DD")}`);
        if (to)
          clientPanelLines.push(`Hasta: ${dayjs(to).format("YYYY-MM-DD")}`);
      }
      if (status) clientPanelLines.push(`Estado: ${status}`);

      // 4) Meta para el motor
      const meta = {
        reportName: "Historial general de ventas",
        ecommerceName: "Tejiendo Sueños",
        printedAt: new Date(),
        timezoneLabel: "Sandoná/Nariño",
        logo,

        // Recuadro derecho (máx 4 líneas)
        otrosDatos: [
          "Dirección: Sandoná, Nariño",
          "Teléfono: +57 3xx xxx xxxx",
          "Email: contacto@tejiendosuenos.co",
        ].join("\n"),

        // Recuadro ancho bajo header (si hay algo que mostrar)
        clientPanelTitle: "Parámetros del reporte",
        clientPanelLines, // puede ser []

        qrReserveWidth: 0, // sin QR en este reporte

        // Totales bajo la tabla
        summaryLines: [`Total vendido: ${formatCOP(sumTotalNumber)}`],

        fileName: "historial_general_ventas.pdf",
      };

      // 5) Estilo (ajústalo a gusto)
      const theme = {};

      // 6) Generar
      generatePdf({
        schema: salesHistorySchema,
        rows: normalizedRows,
        meta,
        theme,
        // sin limit → exporta todo lo filtrado
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo exportar PDF.");
    }
  };

  // ======= Export CSV (COP) =======
  const exportCSV = () => {
    if (!month && dateError) {
      alert(dateError);
      return;
    }
    const data = (rows || []).map((r) => {
      const unitPriceNum =
        typeof r.unitPrice === "number"
          ? r.unitPrice
          : Number(r.unitPrice || 0);
      const totalNum =
        typeof r.total === "number" ? r.total : Number(r.total || 0);

      return {
        fecha: toLocal(r.date),
        usuario: r.userName || "Desconocido",
        producto: r.productName || "Producto eliminado",
        variante: `${r.sizeLabel || "?"} / ${r.colorName || "?"}`,
        precio_unitario: formatCOP(unitPriceNum),
        cantidad: r.quantity ?? 0,
        total: formatCOP(totalNum),
        stock_cierre:
          typeof r.stockAtPurchase === "number"
            ? r.stockAtPurchase
            : r.stockAtPurchase ?? "",
        estado: r.status || "",
        orderId: r.orderId,
        productId: r.productId,
        userId: r.userId,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, "historial_general_ventas.csv");
  };

  return (
    <div className="ao">
      <h2 className="text-xl font-bold mb-3">Historial general de ventas</h2>

      {/* Filtros (aplican solos) */}
      <div className="af mb-4 flex flex-wrap gap-3 items-end">
        {/* Mes (sincroniza Desde/Hasta) */}
        <div>
          <label className="block text-sm">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              const m = e.target.value;
              setMonth(m);

              // Sincroniza visualmente 'Desde' y 'Hasta' con el mes
              const { from: mFrom, toDisplay: mToDisplay } = monthToRange(m);
              setFrom(mFrom);
              setTo(mToDisplay);

              // Limpia error de rango manual (no aplica con mes)
              setDateError("");

              // Aplica filtros con prioridad mes
              applyFiltersNow({ month: m });
            }}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setMonth(""); // usar rango manual => desactiva mes
              applyFiltersDebounced({});
            }}
            onBlur={() => applyFiltersNow({})}
            onKeyDown={handleKeyDownApply}
            className="input"
            max={to || undefined}
          />
        </div>

        <div>
          <label className="block text-sm">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setMonth(""); // usar rango manual => desactiva mes
              applyFiltersDebounced({});
            }}
            onBlur={() => applyFiltersNow({})}
            onKeyDown={handleKeyDownApply}
            className="input"
            min={from || undefined}
          />
        </div>

        <div>
          <label className="block text-sm">Estado</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              applyFiltersNow({ status: e.target.value });
            }}
            className="input"
          >
            <option value="">Todos</option>
            <option value="pendiente">pendiente</option>
            <option value="enviado">enviado</option>
            <option value="entregado">entregado</option>
            <option value="cancelado">cancelado</option>
          </select>
        </div>

        {/* Eliminar filtros */}
        <button className="btn btn--ghost" onClick={handleClearFilters}>
          Limpiar
        </button>

        <button
          className="btn btn--primary"
          onClick={exportPDF}
          disabled={!month && !!dateError}
        >
          Exportar PDF
        </button>
        <button
          className="btn btn--dark"
          onClick={exportCSV}
          disabled={!month && !!dateError}
        >
          Exportar Excel
        </button>
      </div>

      {/* Error fechas (sólo cuando se usa rango manual) */}
      {!month && dateError && <div role="alert">{dateError}</div>}

      <div className="mb-2" role="status" aria-live="polite">
        <strong>Resumen:</strong>{" "}
        <span>Total vendido: {formatCOP(aggregates.sumTotal)}</span>{" "}
        <span className="ml-4">Unidades: {aggregates.sumQty}</span>{" "}
        <span className="ml-4">Pedidos: {aggregates.totalOrders}</span>{" "}
        <span className="ml-4">Clientes: {aggregates.totalClients}</span>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Producto</th>
              <th>Talla</th>
              <th>Color</th>
              <th>Precio unit.</th>
              <th>Cant.</th>
              <th>Total</th>
              <th>Stock cierre</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).length === 0 ? (
              <tr>
                <td colSpan="9">Sin registros.</td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const unitPriceNum =
                  typeof r.unitPrice === "number"
                    ? r.unitPrice
                    : Number(r.unitPrice || 0);
                const totalNum =
                  typeof r.total === "number" ? r.total : Number(r.total || 0);

                return (
                  <tr key={`${r.orderId}-${idx}`}>
                    <td>{toLocal(r.date)}</td>
                    <td>{r.userName || "Desconocido"}</td>
                    <td>{r.productName || "Producto eliminado"}</td>
                    <td> {r.sizeLabel || "?"} </td>
                    <td> {r.colorName || "?"} </td>
                    <td>{formatCOP(unitPriceNum)}</td>
                    <td>{r.quantity ?? 0}</td>
                    <td>{formatCOP(totalNum)}</td>
                    <td>
                      {typeof r.stockAtPurchase === "number"
                        ? r.stockAtPurchase
                        : r.stockAtPurchase ?? "-"}
                    </td>
                    <td>{r.status || ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminSalesHistoryPage;
