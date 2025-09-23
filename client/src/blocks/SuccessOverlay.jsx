import { useEffect, useRef } from "react";

/**
 * Overlay de éxito tras checkout.
 * Props:
 * - open: boolean
 * - humanCode?: string
 * - onPrimary: () => void         // "Volver a la tienda"
 * - onSecondary?: () => void      // "Ver mis pedidos" (opcional)
 * - onClose?: () => void          // cerrar con Esc o click en close
 */
export default function SuccessOverlay({
  open,
  humanCode,
  onPrimary,
  onSecondary,
  onClose,
}) {
  const dialogRef = useRef(null);
  const primaryRef = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // focus management
    prevFocusRef.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab") {
        // focus trap sencillo
        const focusables = dialogRef.current?.querySelectorAll(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // foco inicial
    setTimeout(() => primaryRef.current?.focus(), 0);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocusRef.current) prevFocusRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="so"
      role="dialog"
      aria-modal="true"
      aria-labelledby="so-title"
      onMouseDown={(e) => {
        // cerrar solo si clic fuera de la tarjeta
        if (dialogRef.current && !dialogRef.current.contains(e.target)) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className="so__card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="so__close" onClick={onClose} aria-label="Cerrar">✕</button>

        {/* Animación SVG: palma de iraca -> sombrero */}
        <div className="so__anim" aria-hidden="true">
          <svg className="so__svg" viewBox="0 0 200 120" width="200" height="120">
            {/* PALMA (fase 1) */}
            <g className="so__palm">
              <path d="M100 90 C 95 70, 95 50, 100 30" className="st" />
              <path d="M100 45 C 80 35, 60 30, 40 33" className="st" />
              <path d="M100 45 C 120 35, 140 30, 160 33" className="st" />
              <path d="M98 55 C 80 55, 65 60, 50 70" className="st" />
              <path d="M102 55 C 120 55, 135 60, 150 70" className="st" />
            </g>

            {/* SOMBRERO (fase 2) */}
            <g className="so__hat">
              <ellipse cx="100" cy="70" rx="56" ry="14" className="st" />
              <path d="M68 64 C 80 52, 120 52, 132 64 C 132 74, 68 74, 68 64 Z" className="st" />
              <ellipse cx="100" cy="62" rx="18" ry="6" className="st" />
            </g>
          </svg>
        </div>

        <h2 id="so-title" className="so__title">¡Gracias por tu compra!</h2>
        {humanCode && <p className="so__subtitle">Pedido <b>{humanCode}</b> generado con éxito.</p>}

        <div className="so__actions">
          <button
            ref={primaryRef}
            className="btn btn--primary"
            onClick={onPrimary}
            type="button"
          >
            Volver a la tienda
          </button>
          {onSecondary && (
            <button className="btn btn--ghost" onClick={onSecondary} type="button">
              Ver mis pedidos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
