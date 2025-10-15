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

  // ====== PDF (portrait) ======
  const exportSingleOrderToPDF = () => {
    const ord = order;
    if (!ord) return;

    const safeId = String(ord._id ?? ord.id ?? "").trim();
    const shortId = safeId ? safeId.slice(-8).toUpperCase() : "SIN-ID";

    const asMoney = (n) =>
      Number.isFinite(Number(n)) ? formatCOP(Number(n)) : "$ 0";

    // Items y totales
    const items = Array.isArray(ord.items) ? ord.items : [];
    const unitPriceOf = (it) =>
      Number(
        it?.unitPrice ?? it?.product?.effectivePrice ?? it?.product?.price ?? 0
      );

    const subTotalNumber = items.reduce(
      (acc, it) => acc + unitPriceOf(it) * Number(it?.quantity ?? 0),
      0
    );
    const envioNumber = Number(ord.shippingCost ?? 0);
    const descuentoNumber = Number(ord.discount ?? 0);
    const impuestosNumber = Number(ord.tax ?? 0);
    const totalNumber = Number(
      ord.total ??
        subTotalNumber + envioNumber + impuestosNumber - descuentoNumber
    );

    // Filas de la tabla
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

    // Metadatos (usa los nuevos gaps y reducción de altura en pagos)
    const meta = {
      reportName: `Factura de Pedido: ${shortId}`,
      ecommerceName: "Tejiendo Sueños",
      printedAt: new Date(),
      timezoneLabel: "Sandoná/Nariño",
      logo,

      // Panel cliente 2 columnas (3 y 3)
      clientPanelTitle: "Datos del cliente",
      clientPanelFields: [
        { label: "Cliente", value: ord.user?.name || "N/A" },
        { label: "Email", value: ord.user?.email || "N/A" },
        {
          label: "Creado",
          value: dayjs(ord.createdAt || new Date()).format("YYYY-MM-DD HH:mm"),
        },
        { label: "Estado", value: ord.status || "-" },
        { label: "Guía", value: ord.trackingNumber || "-" },
        { label: "Transportadora", value: ord.shippingCompany || "-" },
      ],
      qrReserveWidth: 35,
      qrShowPlaceholder: true,

      otrosDatos: [
        "Dirección: Sandoná, Nariño",
        "Teléfono: +57 3xx xxx xxxx",
        "Email: contacto@tejiendosuenos.co",
      ].join("\n"),

      // Post-Tabla
      paymentBox: {
        title: "Medios de pago",
        lines: [
        ],
      },

      // Observaciones (izquierda)
      noteTitle: "Observaciones",
      note: ord.adminComment ? String(ord.adminComment) : "",

      // Totales (derecha)
      summaryPairs: [
        { label: "Subtotal", value: asMoney(subTotalNumber) },
        { label: "Envío", value: asMoney(envioNumber) },
        { label: "Descuento", value: asMoney(descuentoNumber) },
        { label: "Impuestos", value: asMoney(impuestosNumber) },
        { label: "TOTAL", value: asMoney(totalNumber), isTotal: true },
      ],
      summaryBox: { width: 68, rowH: 6 },

      fileName: `pedido_${safeId || "sin_id"}.pdf`,
    };

    const theme = {
      MARGINS: { left: 14, right: 14, top: 18, bottom: 16 },
      FONT: { title: 14.5, subtitle: 10, meta: 8.4 },
      TABLE: {
        fontSize: 7.6,
        headFontSize: 9,
        cellPadding: 1.5,
        minCellHeight: 6.4,
      },
      COLORS: {
        title: [130, 70, 25],
        headBg: [130, 70, 25],
        headTx: [255, 255, 255],
        text: [45, 45, 45],
        grid: [225, 229, 235],
        zebra: [248, 250, 252],
        box: [235, 236, 240],
      },
    };

    generatePdf({
      schema: orderInvoiceSchema,
      rows,
      meta,
      theme,
    });
  };

  if (!order) return <p className="loading">Cargando detalles del pedido...</p>;

  const priceFmt = (n) => formatCOP(n);

  const statusHistory = Array.isArray(order.statusHistory)
    ? order.statusHistory
    : [];

  return (
    <div className="admin-order-detail ">
      <div className="section">
        <h3 className="section__title">
          <FaClipboardList className="icon" /> Información del pedido: {order._id.slice(-8).toUpperCase() || "SIN-ID"}
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
      <div className="section ">
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
