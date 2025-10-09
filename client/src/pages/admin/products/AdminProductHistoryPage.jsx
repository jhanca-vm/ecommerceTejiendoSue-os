// src/pages/admin/products/AdminProductHistoryPage.jsx
import React, { useEffect, useState, useContext, useMemo } from "react";

import apiUrl from "../../../api/apiClient";

import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import * as XLSX from "xlsx";

import { generatePdf } from "../../../exports/pdfReportEngine";
import productLedgerSchema from "../../../exports/schemas/productLedger";
import productSalesSchema from "../../../exports/schemas/productSales";
import { formatCOP } from "../../../utils/currency";

const AdminProductHistoryPage = () => {
  const { id } = useParams();
  const { token } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [productName, setProductName] = useState("");
  const TZ_LABEL = "Sandoná/Nariño";

  // Filtros
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [variantKey, setVariantKey] = useState("");

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  useEffect(() => {
    // cargar producto + historiales
    loadProduct();
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProduct = async () => {
    try {
      // Asumiendo endpoint GET /products/:id devuelve { name, ... }
      const res = await apiUrl.get(`products/${id}`, authHeaders);
      const name =
        res?.data?.name || res?.data?.title || res?.data?.productName || "";
      setProductName(String(name));
    } catch {
      // Si falla, dejamos vacío y usamos fallback en el título
      setProductName("");
    }
  };

  const loadData = async (opts = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.from) params.append("from", opts.from);
      if (opts.to) params.append("to", opts.to);
      if (opts.status) params.append("status", opts.status);
      if (opts.variantKey) params.append("variantKey", opts.variantKey);

      const [leg, sal] = await Promise.all([
        apiUrl.get(`products/${id}/ledger?${params.toString()}`, authHeaders),
        apiUrl.get(
          `products/${id}/sales-history?${params.toString()}`,
          authHeaders
        ),
      ]);
      setLedger(Array.isArray(leg.data) ? leg.data : []);
      setSales(Array.isArray(sal.data) ? sal.data : []);
    } catch (e) {
      showToast("Error al obtener historiales", "error");
    } finally {
      setLoading(false);
    }
  };

  const onApplyFilters = () => {
    loadData({ from, to, status, variantKey });
  };

  const toLocal = (d) => (d ? new Date(d).toLocaleString() : "");

  // ===================== EXPORTS =====================
  // A) PDF Ledger (título = nombre de producto)
  const exportLedgerPDF = () => {
    try {
      const rows = (ledger || []).map((r) => ({
        fecha: toLocal(r.createdAt),
        evento: r.eventType || "",
        size: `${r.sizeLabelSnapshot || "?"} `,
        color: `${
          r.colorNameSnapshot || "?"
        }`,
        prev: r.prevStock ?? "",
        nuevo: r.newStock ?? "",
        estado: r.status || "",
        precio: formatCOP(
          r.priceSnapshot === "number" ? r.priceSnapshot : r.priceSnapshot || 0
        ),
        nota: r.note || "",
      }));

      generatePdf({
        schema: productLedgerSchema,
        rows,
        meta: {
          reportName: productName
            ? `Historial por Variante — ${productName}`
            : "Historial por Variante",
          ecommerceName: "Tejiendo Sueños",
          timezoneLabel: TZ_LABEL,
          fileName: `historial_variantes_${id}.pdf`,
        },
      });
    } catch (e) {
      console.error(e);
      showToast("No se pudo exportar el PDF de variantes", "error");
    }
  };

  // B) PDF Ventas (título = nombre de producto)
  const exportSalesPDF = () => {
    try {
      const rows = (sales || []).map((s) => ({
        fecha: toLocal(s.date),
        size: `${s.sizeLabel || "?"}`,
        color: `${s.colorName || "?"}`,
        precioUnit:
          formatCOP (s.unitPrice === "number" ? s.unitPrice : s.unitPrice || 0),
        cantidad: s.quantity ?? 0,
        total: formatCOP (s.total === "number" ? s.total : s.total || 0),
      }));

      generatePdf({
        schema: productSalesSchema,
        rows,
        meta: {
          reportName: productName
            ? `${productName} — Historial de Ventas`
            : "Historial de Ventas",
          ecommerceName: "Tejiendo Sueños",
          timezoneLabel: TZ_LABEL,
          fileName: `historial_ventas_${id}.pdf`,
        },
      });
    } catch (e) {
      console.error(e);
      showToast("No se pudo exportar el PDF de ventas", "error");
    }
  };

  const exportLedgerCSV = () => {
    const rows = (ledger || []).map((r) => ({
      fecha: toLocal(r.createdAt),
      evento: r.eventType || "",
      variante: `${r.sizeLabelSnapshot || "?"} / ${r.colorNameSnapshot || "?"}`,
      stock_prev: r.prevStock ?? "",
      stock_nuevo: r.newStock ?? "",
      estado: r.status || "",
      precio_snapshot:
        typeof r.priceSnapshot === "number"
          ? r.priceSnapshot
          : r.priceSnapshot || "",
      nota: r.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `historial_variantes_${id}.csv`);
  };

  const exportSalesCSV = () => {
    const rows = (sales || []).map((s) => ({
      fecha: toLocal(s.date),
      variante: `${s.sizeLabel || "?"} / ${s.colorName || "?"}`,
      precio_unitario:
        typeof s.unitPrice === "number" ? s.unitPrice : s.unitPrice || 0,
      cantidad: s.quantity ?? 0,
      total: typeof s.total === "number" ? s.total : s.total || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `historial_ventas_${id}.csv`);
  };

  // ===================== UI =====================
  return (
    <div className="ao ">
      <div className="header-row">
        <h2>Historial del producto</h2>
        <button
          className="btn-back"
          onClick={() => navigate("/admin/products")}
        >
          ← Volver
        </button>
      </div>

      <div className="af">
        <label>
          Desde:
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Hasta:
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Estado:
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="DELETED">Eliminado</option>
          </select>
        </label>
        <label>
          Variante (key):
          <input
            placeholder="sizeId::colorId"
            value={variantKey}
            onChange={(e) => setVariantKey(e.target.value)}
          />
        </label>
        <button className="btn" onClick={onApplyFilters}>
          Aplicar filtros
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <section className="card">
            <div className="card-header">
              <h3>Historial por Variante (stock/estado)</h3>
              <div className="actions">
                <button onClick={exportLedgerPDF} className="btn btn--primary">
                  Exportar PDF
                </button>
                <button onClick={exportLedgerCSV} className="btn btn--detail">
                  Exportar Excel
                </button>
              </div>
            </div>
            <table className=" table table-wrap">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Talla</th>
                  <th>Color</th>
                  <th>Stock previo</th>
                  <th>Stock nuevo</th>
                  <th>Estado</th>
                  <th>Precio</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan="8">Sin registros.</td>
                  </tr>
                ) : (
                  ledger.map((r) => (
                    <tr key={r._id}>
                      <td>{toLocal(r.createdAt)}</td>
                      <td>{r.eventType}</td>
                      <td>{r.sizeLabelSnapshot || "?"}</td>
                      <td>{r.colorNameSnapshot || "?"}</td>
                      <td>{r.prevStock ?? ""}</td>
                      <td>{r.newStock ?? ""}</td>
                      <td>{r.status}</td>
                      <td>
                        {formatCOP(
                          r.priceSnapshot === "number"
                            ? r.priceSnapshot
                            : r.priceSnapshot || 0
                        )}
                      </td>
                      <td>{r.note || ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Historial de Ventas</h3>
              <div className="actions">
                <button onClick={exportSalesPDF} className="btn btn--primary">
                  Exportar PDF
                </button>
                <button onClick={exportSalesCSV} className="btn btn--detail">
                  Exportar Excel
                </button>
              </div>
            </div>
            <table className="table table-wrap">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Talla</th>
                  <th>Color</th>
                  <th>Precio unit.</th>
                  <th>Cantidad</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="5">Sin ventas registradas.</td>
                  </tr>
                ) : (
                  sales.map((s, idx) => (
                    <tr key={idx}>
                      <td>{toLocal(s.date)}</td>
                      <td>{s.sizeLabel || "?"}</td>
                      <td>{s.colorName || "?"}</td>
                      <td>
                        {formatCOP(
                          s.unitPrice === "number"
                            ? s.unitPrice
                            : s.unitPrice || 0
                        )}
                      </td>
                      <td>{s.quantity ?? 0}</td>
                      <td>{formatCOP(s.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminProductHistoryPage;
