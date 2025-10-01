// src/pages/admin/products/AdminOrderDetailPage
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useContext } from "react";

import apiUrl from "../../../api/apiClient";

import { AuthContext } from "../../../contexts/AuthContext";
import AdminOrderCommentBlock from "../../../blocks/admin/AdminOrderCommentBlock";
import { toast } from "react-toastify";
import { formatCOP } from "../../../utils/currency";

import { generatePdf } from "../../../exports/pdfReportEngine";
import orderInvoiceSchema from "../../../exports/schemas/orderInvoice";
import logo from "../../../assets/manos.png";
import dayjs from "dayjs";

import {
  FaSave,
  FaTimesCircle,
  FaUser,
  FaTruck,
  FaClipboardList,
  FaClock,
  FaHistory,
} from "react-icons/fa";

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "-");

const labelFor = (k) => {
  switch (k) {
    case "pendiente":
      return "Recibido";
    case "facturado":
      return "Facturado";
    case "enviado":
      return "Enviado";
    case "entregado":
      return "Entregado";
    case "cancelado":
      return "Cancelado";
    default:
      return k;
  }
};

const AdminOrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const [order, setOrder] = useState(null);
  const [fields, setFields] = useState({
    trackingNumber: "",
    shippingCompany: "",
    adminComment: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [orderIds, setOrderIds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await apiUrl.get(`orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOrder(res.data);
        setFields({
          trackingNumber: res.data.trackingNumber || "",
          shippingCompany: res.data.shippingCompany || "",
          adminComment: res.data.adminComment || "",
        });
      } catch (err) {
        console.error(
          "Error cargando pedido:",
          err?.response?.data || err.message
        );
        toast.error("No se pudo cargar el pedido");
      }
    };
    fetchOrder();
  }, [id, token]);

  useEffect(() => {
    const fetchIds = async () => {
      try {
        const res = await apiUrl.get(`orders/ids`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ids = res.data || [];
        setOrderIds(ids);
        const index = ids.findIndex((oid) => oid === id);
        setCurrentIndex(index);
      } catch (err) {
        console.error(
          "Error cargando IDs de pedidos:",
          err?.response?.data || err.message
        );
      }
    };
    fetchIds();
  }, [id, token]);

  const handleFieldChange = (field, value) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        trackingNumber: fields.trackingNumber,
        shippingCompany: fields.shippingCompany,
        adminComment: fields.adminComment,
      };

      await apiUrl.put(`orders/${id}`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success("Pedido actualizado con éxito");
      setTimeout(() => navigate("/admin"), 1200);
    } catch (err) {
      console.error(
        "Error al guardar los cambios:",
        err?.response?.data || err.message
      );
      toast.error(err?.response?.data?.error || "Error al guardar los cambios");
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin");
  };

  // ====== PDF (landscape) ======
  const exportSingleOrderToPDF = () => {
    if (!order) return;
    
    const asBlank = (n) => (Number(n) ? formatCOP(Number(n)) : "-");

    // --- Cálculos de totales (por si no vienen precomputados) ---
    const items = order.items || [];
    const unitPriceOf = (it) =>
      Number(
        it?.unitPrice ?? it?.product?.effectivePrice ?? it?.product?.price ?? 0
      );
    const subTotalNumber = items.reduce(
      (acc, it) => acc + unitPriceOf(it) * Number(it?.quantity ?? 0),
      0
    );
    const envioNumber = Number(order.shippingCost ?? 0);
    const descuentoNumber = Number(order.discount ?? 0);
    const impuestosNumber = Number(order.tax ?? 0);
    const totalNumber = Number(
      order.total ??
        subTotalNumber + envioNumber + impuestosNumber - descuentoNumber
    );

    // --- Filas de la tabla (mapeo al schema) ---
    const rows = items.map((item) => {
      const unit = unitPriceOf(item);
      const qty = Number(item?.quantity ?? 0);
      const subtotal = unit * qty;

      return {
        product: item?.product?.name || "Producto eliminado",
        size: item?.size?.label || "-",
        color: item?.color?.name || "-",
        qty: String(qty),
        price: String(formatCOP(unit)),
        subtotal: String(formatCOP(subtotal)),
      };
    });

    // --- Metadatos y paneles de cabecera ---
    const meta = {
      reportName: `Factura de Pedido: ${order._id.slice(-8).toUpperCase()}`,
      ecommerceName: "Tejiendo Sueños",
      printedAt: new Date(),
      timezoneLabel: "Sandoná/Nariño",
      logo,
      // Recuadro grande debajo del header:
      clientPanelTitle: "Datos del cliente",
      clientPanelLines: [
        ' ',
        `Cliente: ${order.user?.name || "N/A"}`,
        `Email: ${order.user?.email || "N/A"}`,
        `Creado: ${dayjs(order.createdAt).format("YYYY-MM-DD HH:mm")}`,
        `Estado: ${order.status || "-"}`,
        ...(order.trackingNumber ? [`Guía: ${order.trackingNumber}`] : []),
        ...(order.shippingCompany
          ? [`Transportadora: ${order.shippingCompany}`]
          : []),
      ],
      qrReserveWidth: 38, // espacio reservado (mm) para QR a la derecha
      qrShowPlaceholder: true, // muestra “QR (próximamente)”

      // Caja derecha pequeña (igual que antes)
      otrosDatos: [
        "Dirección: Sandoná, Nariño",
        "Teléfono: +57 3xx xxx xxxx",
        "Email: contacto@tejiendosuenos.co",
      ].join("\n"),

      // Totales + nota
    summaryLines: [
    `Subtotal: ${formatCOP(subTotalNumber)}`,
    `Envío: ${asBlank(envioNumber)}`,                   
    `Descuento: ${asBlank(descuentoNumber) ? + asBlank(descuentoNumber) : ""}`, 
    `Impuestos: ${asBlank(impuestosNumber)}`,
    `TOTAL: ${formatCOP(totalNumber)}`,
  ],
      note: order.adminComment ? String(order.adminComment) : "",

      fileName: `pedido_${order._id}.pdf`,
    };

    // --- Densidad/estética (opcional) ---
    const theme = {
      // 1) Márgenes más elegantes (más aire)
      MARGINS: { left: 16, right: 16, top: 20, bottom: 16 },

      // 2) Tipografías (jerarquía más clara)
      FONT: { title: 16.5, subtitle: 11, meta: 9 },

      // 3) Densidad de tabla (comodidad ≠ apretado)
      TABLE: {
        fontSize: 8.6,
        headFontSize: 10,
        cellPadding: 2,
        minCellHeight: 7.6,
      },

      // 4) Colores de marca (ajusta el marrón si lo deseas)
      COLORS: {
        title: [130, 70, 25], // título un poco más cálido
        headBg: [130, 70, 25],
        headTx: [255, 255, 255],
        text: [45, 45, 45],
        grid: [225, 229, 235],
        zebra: [248, 250, 252],
        box: [235, 236, 240],
      },
    };

    // --- Generar PDF (portrait por defecto en el motor) ---
    generatePdf({
      schema: orderInvoiceSchema,
      rows,
      meta,
      theme,
      // sin 'limit' => imprime todos los ítems y pagina automáticamente
    });
  };

  if (!order) return <p className="loading">Cargando detalles del pedido...</p>;

  const priceFmt = (n) => formatCOP(n);

  const statusHistory = Array.isArray(order.statusHistory)
    ? order.statusHistory
    : [];

  return (
    <div className="admin-order-detail">
      <div className="section">
        <h3 className="section__title">
          <FaClipboardList className="icon" /> Información del pedido
        </h3>
        <p className="field">
          <strong>
            <FaUser className="icon" /> Usuario Email:
          </strong>{" "}
          {order.user?.email}
        </p>
        <p className="field">
          <strong>Usuario Nombre:</strong> {order.user?.name}
        </p>
        <p className="field">
          <strong>Estado actual:</strong> {order.status}
        </p>
        <p className="field">
          <strong>
            <FaClock className="icon" /> Fecha estado actual:
          </strong>{" "}
          {fmtDate(order.currentStatusAt || order.updatedAt)}
        </p>
        <p className="field">
          <strong>Creado:</strong> {fmtDate(order.createdAt)}
        </p>
      </div>

      <div className="actions-top">
        <button className="btn btn--ghost" onClick={exportSingleOrderToPDF}>
          Descargar Factura
        </button>
      </div>

      {/* Productos del pedido */}
      <div className="section">
        <h3 className="section__title">
          <FaClipboardList className="icon" /> Productos del pedido
        </h3>

        <div className="table-responsive">
          <table className="table table-order-items">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Variante</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, idx) => {
                const hasPrice = typeof item.product?.price === "number";
                const price = hasPrice ? item.product.price : 0;
                const qty = Number(item.quantity) || 0;
                const subtotal = qty * Number(price);
                return (
                  <tr key={item._id || idx}>
                    <td>{item.product?.name || "Producto eliminado"}</td>
                    <td className="variant-cell">
                      <table className="variant-mini-table">
                        <thead>
                          <tr>
                            <th>Talla</th>
                            <th>Color</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{item.size?.label || "-"}</td>
                            <td>{item.color?.name || "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td>{qty}</td>
                    <td>{hasPrice ? priceFmt(price) : "-"}</td>
                    <td>{hasPrice ? priceFmt(subtotal) : "-"}</td>
                  </tr>
                );
              })}
              {(!order.items || order.items.length === 0) && (
                <tr>
                  <td colSpan={5}>
                    <em>Sin ítems</em>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="total-label" colSpan={4}>
                  Total
                </td>
                <td className="total-value">{priceFmt(order.total ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Fechas por estado */}
      {order?.statusTimestamps && (
        <div className="section">
          <h3 className="section__title">
            <FaClock className="icon" /> Fechas por estado
          </h3>
          <div className="table-responsive">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(order.statusTimestamps).map(([k, v]) => (
                  <tr key={k}>
                    <td>{labelFor(k)}</td>
                    <td>{fmtDate(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial de estados */}
      {statusHistory.length > 0 && (
        <div className="section">
          <h3 className="section__title">
            <FaHistory className="icon" /> Historial de estados
          </h3>
          <div className="table-responsive">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Desde</th>
                  <th>Hacia</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {statusHistory
                  .slice()
                  .sort((a, b) => new Date(b.at) - new Date(a.at))
                  .map((h, i) => (
                    <tr key={i}>
                      <td>{labelFor(h.from)}</td>
                      <td>{labelFor(h.to)}</td>
                      <td>{fmtDate(h.at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metadatos editables */}
      <div className="section">
        <h3 className="section__title">
          <FaTruck className="icon" /> Información de envío
        </h3>
        <AdminOrderCommentBlock
          comment={fields.adminComment}
          trackingNumber={fields.trackingNumber}
          shippingCompany={fields.shippingCompany}
          onFieldChange={handleFieldChange}
        />
      </div>

      {/* Acciones */}
      <div className="section">
        <h3 className="section__title">💾 Acciones</h3>
        <div className="actions-row">
          <button
            onClick={handleSave}
            className={`btn btn--primary ${isSaving ? "is-disabled" : ""}`}
            disabled={isSaving}
            title="Guardar cambios en el pedido"
          >
            <FaSave className="icon" />
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>

          <button
            onClick={handleCancel}
            className="btn btn--muted"
            title="Cancelar cambios y volver"
          >
            <FaTimesCircle className="icon" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
