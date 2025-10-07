/// src/exports/pdfReportEngine.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../assets/manos.png";

export function generatePdf({ schema, rows, meta, theme, limit }) {
  // Tema compacto por defecto; puedes sobreescribir con "theme"
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
    MARGINS: { left: 14, right: 14, top: 18, bottom: 16 },
    FONT: {
      family: "helvetica",
      base: 9,
      title: 14.5,
      subtitle: 10,
      meta: 8.5,
    },
    TABLE: {
      fontSize: 7.8,
      headFontSize: 9.2,
      cellPadding: 1.6,
      minCellHeight: 6.6,
    },
    ...(theme || {}),
  };

  const md = {
    reportName: meta?.reportName || "Reporte",
    ecommerceName: meta?.ecommerceName || "",
    printedAt: meta?.printedAt || new Date(),
    timezoneLabel: meta?.timezoneLabel || "Sandona/Nariño",
    logo: meta?.logo || logo,
    otrosDatos: meta?.otrosDatos || "",

    // Panel cliente (grid 2xN o líneas)
    clientPanelTitle: meta?.clientPanelTitle || "Datos del cliente",
    clientPanelFields: Array.isArray(meta?.clientPanelFields)
      ? meta.clientPanelFields
      : null, // [{label, value}, ...]
    clientPanelLines: Array.isArray(meta?.clientPanelLines)
      ? meta.clientPanelLines
      : [],
    clientPanelGrid: { cols: 2, rows: 3, rowH: 4.2, titleH: 5.2, gapCol: 18 },

    // QR
    qrReserveWidth: Number(meta?.qrReserveWidth ?? 35),
    qrShowPlaceholder: meta?.qrShowPlaceholder ?? true,

    // info extra bajo títulos
    infoLeft: Array.isArray(meta?.infoLeft) ? meta.infoLeft : [],

    // Post-tabla
    paymentBox: meta?.paymentBox || null, // {title, lines:[]}

    // Totales (derecha)
    summaryPairs: Array.isArray(meta?.summaryPairs) ? meta.summaryPairs : null,
    summaryBox: {
      width: Number(meta?.summaryBox?.width ?? 68),
      rowH: Number(meta?.summaryBox?.rowH ?? 6),
    },

    // Observaciones (izquierda)
    note: meta?.note || " ",
    noteTitle: meta?.noteTitle || null,

    // Compat: summaryLines viejo
    summaryLines: Array.isArray(meta?.summaryLines) ? meta.summaryLines : [],

    fileName: meta?.fileName || "reporte.pdf",

    // === NUEVO: gaps (distancia título → contenido) ===
    clientPanelGap: 5,
    paymentBoxGap: 5,
    noteBoxGap: 5,

    // === Opciones de ancho/alineación de medios de pago (si las usas) ===
    paymentBoxWidthMm:
      typeof meta?.paymentBoxWidthMm === "number"
        ? meta.paymentBoxWidthMm
        : null,
    paymentBoxWidthPct:
      typeof meta?.paymentBoxWidthPct === "number"
        ? meta.paymentBoxWidthPct
        : null,
    paymentBoxAlign: meta?.paymentBoxAlign || "left", // 'left' | 'center' | 'right'

    // === Control de altura mínima y factor de reducción para pagos ===
    paymentBoxMinHeightMm:
      typeof meta?.paymentBoxMinHeightMm === "number"
        ? meta.paymentBoxMinHeightMm
        : 10,
    paymentBoxHalfHeight: true, // Reducir a la mitad la altura calculada
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  doc.setFont(th.FONT.family, "normal");
  doc.setTextColor(...th.COLORS.text);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { left, right, top, bottom } = th.MARGINS;
  const contentW = pageW - left - right;

  /* ===== Header (logo + títulos + caja otrosDatos) ===== */
  let cursorY = top;
  const LOGO_W = 18;
  if (md.logo) {
    try {
      doc.addImage(
        md.logo,
        "PNG",
        left,
        cursorY - 1,
        LOGO_W,
        12,
        undefined,
        "FAST"
      );
    } catch {
      /* ignore */
    }
  }

  const titleX = left + (md.logo ? LOGO_W + 4 : 0);

  doc.setFontSize(th.FONT.title);
  doc.setTextColor(...th.COLORS.title);
  doc.text(md.reportName, titleX, cursorY + 3.5);

  doc.setFontSize(th.FONT.subtitle);
  doc.setTextColor(...th.COLORS.text);
  if (md.ecommerceName) doc.text(md.ecommerceName, titleX, cursorY + 9);

  doc.setFontSize(th.FONT.meta);
  const generatedAt =
    md.printedAt instanceof Date ? md.printedAt : new Date(md.printedAt);
  doc.text(
    `Generado: ${toDateTime(generatedAt)} (${md.timezoneLabel})`,
    titleX,
    cursorY + 13
  );

  // infoLeft bajo el título
  let extraLinesHeight = 0;
  if (md.infoLeft.length) {
    doc.setFontSize(th.FONT.meta);
    let yL = cursorY + 16;
    for (const line of md.infoLeft.slice(0, 6)) {
      doc.text(safeText(line, 80), titleX, yL);
      yL += 3.6;
      extraLinesHeight += 3.6;
    }
  }

  // Caja derecha (otrosDatos)
  const headBoxW = 68;
  const headBoxX = pageW - right - headBoxW;
  const headBoxY = cursorY - 3;
  if (md.otrosDatos) {
    doc.setDrawColor(...th.COLORS.box);
    doc.setLineWidth(0.2);
    doc.rect(headBoxX, headBoxY, headBoxW, 14);
    doc.setFontSize(th.FONT.meta);
    const lines = String(md.otrosDatos).split(/\r?\n/).slice(0, 4);
    let y = headBoxY + 4.2;
    for (const line of lines) {
      doc.text(safeText(line, 56), headBoxX + 3, y);
      y += 3.8;
    }
  }

  /* ===== Panel "Datos del cliente" + reserva QR ===== */
  const panelTop = cursorY + 18 + extraLinesHeight;
  const gap = 6;
  const qrW = Math.max(0, Math.min(md.qrReserveWidth, 60));
  const panelW = contentW - (qrW ? qrW + gap : 0);

  // Alturas
  const titleH = md.clientPanelGrid.titleH;
  let panelH = 0;

  if (
    (md.clientPanelFields && md.clientPanelFields.length) ||
    md.clientPanelLines.length
  ) {
    // Calcula altura según modo
    if (md.clientPanelFields && md.clientPanelFields.length) {
      const rows = md.clientPanelGrid.rows || 3;
      const rowH = md.clientPanelGrid.rowH;
      panelH = titleH + 2 + rows * rowH + 4;
    } else {
      const rowH = 4.2;
      panelH = titleH + 2 + md.clientPanelLines.length * rowH + 4;
    }

    doc.setDrawColor(...th.COLORS.grid);
    doc.setLineWidth(0.25);
    doc.roundedRect(left, panelTop, panelW, panelH, 2, 2, "S");

    // Título
    doc.setFontSize(th.FONT.subtitle);
    doc.text(md.clientPanelTitle, left + 3, panelTop + titleH);

    // Contenido
    doc.setFontSize(th.FONT.meta);

    if (md.clientPanelFields && md.clientPanelFields.length) {
      // Grid 2xN (3 y 3)
      const rows = md.clientPanelGrid.rows || 3;
      const rowH = md.clientPanelGrid.rowH;
      const gapCol = md.clientPanelGrid.gapCol;
      const colW = (panelW - gapCol - 6) / 2; // 3 de padding a cada lado

      let y = panelTop + titleH + md.clientPanelGap; // GAP aumentado a 5
      for (let i = 0; i < rows; i++) {
        const L = md.clientPanelFields[i * 2];
        const R = md.clientPanelFields[i * 2 + 1];

        if (L)
          doc.text(`${safeText(L.label)}: ${safeText(L.value)}`, left + 3, y);
        if (R)
          doc.text(
            `${safeText(R.label)}: ${safeText(R.value)}`,
            left + 3 + colW + gapCol,
            y
          );
        y += rowH;
      }
    } else {
      // Modo líneas (compat)
      const rowH = 4.2;
      let y = panelTop + titleH + md.clientPanelGap; // GAP aumentado a 5
      for (const L of md.clientPanelLines.slice(0, 8)) {
        doc.text(safeText(L, 120), left + 3, y);
        y += rowH;
      }
    }

    // QR derecha (misma altura)
    if (qrW > 0) {
      const qrH = panelH;
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

  /* ===== Separador debajo del panel ===== */
  const sepY =
    (panelH ? panelTop + panelH : cursorY + 16 + extraLinesHeight) + 5;

  doc.setDrawColor(...th.COLORS.grid);
  doc.setLineWidth(0.3);
  doc.line(left, sepY, pageW - right, sepY);

  /* ===== Tabla ===== */
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
    startY: sepY + 2, // antes +4 → a la mitad
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

  /* ===== Post-Tabla: Medios de pago (horizontal), Observaciones (izq) + Totales (der) ===== */
  const endY = doc.lastAutoTable?.finalY ?? sepY + 12;
  let y = endY + 4; // antes +8 → mitad

  // 1) Medios de pago - caja horizontal (altura reducida a la mitad)
  if (md.paymentBox && Array.isArray(md.paymentBox.lines)) {
    const padY = 4;
    const titleH2 = 5.2;
    const rowH2 = 4.2;
    const lines = md.paymentBox.lines.slice(0, 10);

    // Altura base según líneas:
    let hBase = titleH2 + padY + lines.length * rowH2 + padY;

    // Reduce a la mitad si está activado:
    if (md.paymentBoxHalfHeight) {
      hBase = Math.max(md.paymentBoxMinHeightMm, Math.round(hBase * 0.5));
    } else {
      hBase = Math.max(md.paymentBoxMinHeightMm, hBase);
    }

    // Ancho/posición (si se usan opciones)
    const fullW = contentW;
    let boxW = fullW;
    if (typeof md.paymentBoxWidthMm === "number") {
      boxW = Math.max(40, Math.min(md.paymentBoxWidthMm, fullW));
    } else if (typeof md.paymentBoxWidthPct === "number") {
      boxW = Math.max(40, Math.min(fullW, fullW * md.paymentBoxWidthPct));
    }
    let boxX = left;
    if (md.paymentBoxAlign === "center") boxX = left + (fullW - boxW) / 2;
    if (md.paymentBoxAlign === "right") boxX = left + (fullW - boxW);

    // Caja
    drawRoundedBox(doc, boxX, y, boxW, hBase, 2, th.COLORS.grid);

    // Título
    doc.setFontSize(th.FONT.subtitle);
    doc.text(
      String(md.paymentBox.title || "Medios de pago"),
      boxX + 3,
      y + titleH2
    );

    // Contenido con GAP aumentado a 5
    doc.setFontSize(th.FONT.meta);
    let cy = y + titleH2 + md.paymentBoxGap;
    for (const t of lines) {
      doc.text(safeText(String(t), 150), boxX + 3, cy);
      cy += rowH2;
    }

    y += hBase + 3; // antes +6 → mitad
  }

  // 2) Fila: Observaciones (izquierda) + Totales (derecha)
  const sumW = Math.min(md.summaryBox.width, contentW);
  const sumX = pageW - right - sumW;
  const leftW = contentW - 6 - sumW;

  // Observaciones
  const noteText = String(md.note || "").trim();
  const showNoteBox = md.noteTitle || noteText;
  let noteH = 0;
  if (showNoteBox) {
    const padY = 4;
    const titleHn = 5.2;
    const maxW = leftW - 6;
    const noteLines = noteText ? doc.splitTextToSize(noteText, maxW) : [" "];
    noteH = titleHn + padY + noteLines.length * 4 + padY;

    drawRoundedBox(doc, left, y, leftW, noteH, 2, th.COLORS.grid);
    doc.setFontSize(th.FONT.subtitle);
    doc.text(String(md.noteTitle || "Observaciones"), left + 3, y + titleHn);

    doc.setFontSize(th.FONT.meta);
    let cy = y + titleHn + md.noteBoxGap; // GAP aumentado a 5
    for (const ln of noteLines) {
      doc.text(ln, left + 3, cy);
      cy += 4;
    }
  }

  // Totales
  let sumH = 0;
  if (md.summaryPairs?.length) {
    const rowH = md.summaryBox.rowH;
    const padY = 4;
    sumH = padY + md.summaryPairs.length * rowH + padY;

    drawRoundedBox(doc, sumX, y, sumW, sumH, 2, th.COLORS.grid);
    drawKeyValueRows(
      doc,
      sumX + 2,
      y + padY + rowH - 1,
      sumW - 4,
      md.summaryPairs,
      {
        rowH,
        totalBold: true,
      }
    );
  } else if (md.summaryLines.length) {
    // compat
    let yS = y + 2;
    for (let i = 0; i < md.summaryLines.length; i++) {
      const line = String(md.summaryLines[i]);
      const isTotal = /TOTAL/i.test(line);
      doc.setFontSize(isTotal ? th.FONT.subtitle + 1 : th.FONT.meta + 0.5);
      const w = doc.getTextWidth(line);
      doc.text(line, sumX + sumW - 2 - w, yS);
      yS += isTotal ? 6 : 5;
    }
  }

  // Ajuste final
  y += Math.max(noteH, sumH) + 2; // antes +4 → mitad

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
  return (
    String(str || "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .slice(0, maxLen)
  );
}
function ellipsisMid(str, max) {
  const s = String(str || "");
  if (!max || s.length <= max) return s;
  const keep = Math.max(2, Math.floor((max - 1) / 2));
  return s.slice(0, keep) + "…" + s.slice(-keep);
}
function drawRoundedBox(doc, x, y, w, h, radius = 2, color = [231, 231, 231]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, radius, radius, "S");
}
function drawKeyValueRows(doc, x, y, w, rows, opts = {}) {
  const { rowH = 6, totalBold = true } = opts;
  let cy = y;
  for (const r of rows) {
    const label = safeText(r?.label ?? "", 60);
    const value = safeText(r?.value ?? "-", 60);
    const isTotal = !!r?.isTotal;

    doc.setFontSize(isTotal && totalBold ? 11 : 9.5);
    doc.setFont(undefined, isTotal && totalBold ? "bold" : "normal");
    doc.text(label, x + 2, cy);

    const vw = doc.getTextWidth(value);
    doc.text(value, x + w - 2 - vw, cy);

    cy += rowH;
  }
  doc.setFont(undefined, "normal");
  return cy;
}
