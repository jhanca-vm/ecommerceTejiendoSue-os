// src/exports/pdfReportEngine.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generatePdf({ schema, rows, meta, theme, limit }) {
  const th = {
    COLORS: {
      text: [31, 41, 55],
      title: [122, 62, 21],
      headBg: [122, 62, 21],
      headTx: [255, 255, 255],
      grid: [220, 226, 235],
      zebra: [246, 247, 249],
      box: [231, 231, 231],
    },
    MARGINS: { left: 10, right: 10, top: 15, bottom: 20 },
    FONT: { family: "helvetica", base: 10, title: 16, subtitle: 11, meta: 9 },
    TABLE: {
      fontSize: 8.2,
      headFontSize: 9.7,
      cellPadding: 1.8,
      minCellHeight: 7.2,
    },
    ...(theme || {}),
  };

  const md = {
    reportName: meta?.reportName || "Reporte",
    ecommerceName: meta?.ecommerceName || "",
    printedAt: meta?.printedAt || new Date(),
    timezoneLabel: meta?.timezoneLabel || "Sandona/Nariño",
    logo: meta?.logo,
    otrosDatos: meta?.otrosDatos || "",

    // NUEVO: panel cliente + QR
    clientPanelTitle: meta?.clientPanelTitle || "Datos del cliente",
    clientPanelLines: Array.isArray(meta?.clientPanelLines)
      ? meta.clientPanelLines
      : [],
    qrReserveWidth: Number(meta?.qrReserveWidth ?? 38), // mm reservados para QR (futuro)
    qrShowPlaceholder: meta?.qrShowPlaceholder ?? true, // muestra “QR (próximamente)”

    infoLeft: Array.isArray(meta?.infoLeft) ? meta.infoLeft : [], // si lo usas
    summaryLines: Array.isArray(meta?.summaryLines) ? meta.summaryLines : [],
    note: meta?.note || "",
    fileName: meta?.fileName || "reporte.pdf",
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  doc.setFont(th.FONT.family, "normal");
  doc.setTextColor(...th.COLORS.text);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { left, right, top, bottom } = th.MARGINS;
  const contentW = pageW - left - right;

  // ===== Header (logo + títulos + caja otrosDatos) =====
  let cursorY = top;
  const LOGO_W = 20;
  if (md.logo) {
    try {
      doc.addImage(
        md.logo,
        "PNG",
        left,
        cursorY - 2,
        LOGO_W,
        14,
        undefined,
        "FAST"
      );
    } catch { /* empty */ }
  }

  const titleX = left + (md.logo ? LOGO_W + 4 : 0);

  doc.setFontSize(th.FONT.title);
  doc.setTextColor(...th.COLORS.title);
  doc.text(md.reportName, titleX, cursorY + 4);

  doc.setFontSize(th.FONT.subtitle);
  doc.setTextColor(...th.COLORS.text);
  if (md.ecommerceName) doc.text(md.ecommerceName, titleX, cursorY + 10);

  doc.setFontSize(th.FONT.meta);
  const generatedAt =
    md.printedAt instanceof Date ? md.printedAt : new Date(md.printedAt);
  doc.text(
    `Generado: ${toDateTime(generatedAt)} (${md.timezoneLabel})`,
    titleX,
    cursorY + 14
  );

  // infoLeft (si lo usas) bajo el título
  let extraLinesHeight = 0;
  if (md.infoLeft.length) {
    doc.setFontSize(th.FONT.meta);
    let yL = cursorY + 18;
    for (const line of md.infoLeft.slice(0, 8)) {
      doc.text(safeText(line, 80), titleX, yL);
      yL += 4;
      extraLinesHeight += 4;
    }
  }

  // Caja derecha (otrosDatos)
  const headBoxW = 70;
  const headBoxX = pageW - right - headBoxW;
  const headBoxY = cursorY - 4;
  if (md.otrosDatos) {
    doc.setDrawColor(...th.COLORS.box);
    doc.setLineWidth(0.2);
    doc.rect(headBoxX, headBoxY, headBoxW, 15);
    doc.setFontSize(th.FONT.meta);
    const lines = String(md.otrosDatos).split(/\r?\n/).slice(0, 4);
    let y = headBoxY + 5;
    for (const line of lines) {
      doc.text(safeText(line, 56), headBoxX + 3, y);
      y += 4;
    }
  }

  // ===== NUEVO: Panel "Datos del cliente" + reserva QR debajo del header =====
  const panelTop = cursorY + 20 + extraLinesHeight; // debajo del bloque superior
  const gap = 6; // espacio entre panel y QR
  const qrW = Math.max(0, Math.min(md.qrReserveWidth, 60)); // límite sensato
  const panelW = contentW - (qrW ? qrW + gap : 0);
  const lineH = 4.4; // alto por línea
  const titleH = 5.5;
  const panelLines = md.clientPanelLines.slice(0, 10); // hasta 10 líneas

  let panelH = 0;
  if (panelLines.length) {
    panelH = titleH + 2 + panelLines.length * lineH + 4; // título + líneas + padding
    // Caja cliente (izquierda)
    doc.setDrawColor(...th.COLORS.grid);
    doc.setLineWidth(0.25);
    doc.roundedRect(left, panelTop, panelW, panelH, 2, 2, "S");

    // Título del panel
    doc.setFontSize(th.FONT.subtitle);
    doc.text(md.clientPanelTitle, left + 3, panelTop + titleH);

    // Líneas del panel
    doc.setFontSize(th.FONT.meta);
    let y = panelTop + titleH + 2;
    for (const L of panelLines) {
      doc.text(safeText(L, 120), left + 3, y);
      y += lineH;
    }

    // Reserva QR (derecha), con placeholder
    if (qrW > 0) {
      const qrH = panelH; // a la misma altura del panel
      const qrX = left + panelW + gap;
      const qrY = panelTop;

      doc.setDrawColor(...th.COLORS.grid);
      doc.roundedRect(qrX, qrY, qrW, qrH, 2, 2, "S");

      if (md.qrShowPlaceholder) {
        doc.setFontSize(th.FONT.meta);
        const txt = "QR (próximamente)";
        const tw = doc.getTextWidth(txt);
        doc.text(txt, qrX + (qrW - tw) / 2, qrY + qrH / 2);
      }
    }
  }

  // ===== Separador debajo del panel cliente/QR =====
  const sepY = panelLines.length
    ? panelTop + panelH + 6
    : cursorY + 18 + extraLinesHeight;
  doc.setDrawColor(...th.COLORS.grid);
  doc.setLineWidth(0.3);
  doc.line(left, sepY, pageW - right, sepY);

  // ===== Tabla =====
  const columns = (schema?.columns || []).map((c) => ({
    header: c.header,
    dataKey: c.key,
  }));
  const totalRows = Array.isArray(rows) ? rows.length : 0;
  const hardLimit = Number.isFinite(limit) && limit > 0 ? limit : totalRows;
  const visibleRows = (rows || []).slice(0, hardLimit);

  const numericWidths = (schema?.columns || []).map((c) =>
    typeof c.width === "number" ? c.width : 0
  );
  const sumNumeric = numericWidths.reduce((a, b) => a + b, 0);
  let widthScale = 1;
  if (sumNumeric > 0 && sumNumeric > contentW)
    widthScale = contentW / sumNumeric;

  const body = visibleRows.map((r) => {
    const out = {};
    for (const c of schema?.columns || []) {
      let v = r[c.key];
      v = v == null ? "—" : String(v);
      if (c.truncate) v = ellipsisMid(v, c.truncate);
      out[c.key] = v;
    }
    return out;
  });

  const columnStyles = {};
  for (const c of schema?.columns || []) {
    const rawW = typeof c.width === "number" ? c.width : c.width || "auto";
    const scaledW =
      typeof rawW === "number" ? Math.floor(rawW * widthScale) : rawW;
    columnStyles[c.key] = {
      cellWidth: scaledW,
      halign: c.align || (c.type === "number" ? "right" : "left"),
      valign: "middle",
      fontSize: c.fontSize ?? th.TABLE.fontSize,
      cellPadding: c.padding ?? th.TABLE.cellPadding,
      minCellHeight: c.minHeight ?? th.TABLE.minCellHeight,
    };
  }

  autoTable(doc, {
    startY: sepY + 4,
    tableWidth: contentW,
    columns,
    body,
    theme: "grid",
    margin: { left, right, top, bottom },
    styles: {
      font: th.FONT.family,
      fontSize: th.TABLE.fontSize,
      cellPadding: th.TABLE.cellPadding,
      minCellHeight: th.TABLE.minCellHeight,
      lineColor: th.COLORS.grid,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
      textColor: th.COLORS.text,
    },
    headStyles: {
      fillColor: th.COLORS.headBg,
      textColor: th.COLORS.headTx,
      fontSize: th.TABLE.headFontSize,
      lineWidth: 0,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: th.COLORS.zebra },
    columnStyles,
    didDrawPage: (data) => {
      const now =
        md.printedAt instanceof Date ? md.printedAt : new Date(md.printedAt);
      const printedStr = `${toDateTime(now)} (${md.timezoneLabel}) — ${
        md.ecommerceName
      }`;
      const pageStr = `Página ${
        data.pageNumber
      } de ${doc.internal.getNumberOfPages()}`;

      doc.setFontSize(th.FONT.meta);
      doc.setTextColor(90);
      doc.text(printedStr, left, pageH - 6, { baseline: "bottom" });
      const textW = doc.getTextWidth(pageStr);
      doc.text(pageW - right - textW, pageH - 6, pageStr, {
        baseline: "bottom",
      });
    },
  });

  // ===== Resumen + Nota =====
  const endY = doc.lastAutoTable?.finalY ?? sepY + 12;
  let ySummary = endY + 8;

  if (md.summaryLines.length) {
    for (let i = 0; i < md.summaryLines.length; i++) {
      const line = String(md.summaryLines[i]);
      const isTotal = /TOTAL/i.test(line);
      doc.setFontSize(isTotal ? th.FONT.subtitle + 1 : th.FONT.meta + 0.5);
      const w = doc.getTextWidth(line);
      doc.text(line, pageW - right - w, ySummary);
      ySummary += isTotal ? 6 : 5;
    }
  }

  if (md.note) {
    ySummary += 4;
    doc.setFontSize(th.FONT.subtitle);
    doc.text("Observaciones:", left, ySummary);
    ySummary += 5;

    doc.setFontSize(th.FONT.meta);
    const noteLines = doc.splitTextToSize(String(md.note), contentW);
    for (const ln of noteLines) {
      doc.text(ln, left, ySummary);
      ySummary += 4;
    }
  }

  doc.save(md.fileName);
}

/* ===== Helpers ===== */
function pad(n) {
  return String(n).padStart(2, "0");
}
function toDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function safeText(str, maxLen = 80) {
  return String(str || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLen);
}
function ellipsisMid(str, max) {
  const s = String(str || "");
  if (!max || s.length <= max) return s;
  const keep = Math.max(2, Math.floor((max - 1) / 2));
  return s.slice(0, keep) + "…" + s.slice(-keep);
}
