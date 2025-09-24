import { useEffect, useRef } from "react";
import BrandCelebration from "./BrandCelebration";

//import palma from "../assets/animations/palma_sombrero.json";

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
    prevFocusRef.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables?.length) return;
        const first = focusables[0],
          last = focusables[focusables.length - 1];
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
    setTimeout(() => primaryRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="so"
      role="dialog"
      aria-modal="true"
      aria-labelledby="so-title"
      aria-describedby="so-desc"
      onMouseDown={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target))
          onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className="so__card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="so__close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        <div className="so__anim" aria-hidden="true">
          <BrandCelebration
            //renderer="lottie"
            //lottieSrc="/assets/animations/palma_sombrero.json"
          />
        </div>

        <h2 id="so-title" className="so__title">
          ¡Gracias por tu compra!
        </h2>
        <p id="so-desc" className="so__subtitle">
          {humanCode ? (
            <>
              Pedido <b>{humanCode}</b> generado con éxito. Elige una opción
              para continuar.
            </>
          ) : (
            <>Compra finalizada con éxito. Elige una opción para continuar.</>
          )}
        </p>

        <div className="so__actions">
          <button
            className="btn btn--primary"
            onClick={onPrimary}
            type="button"
          >
            Volver a la tienda
          </button>
          {onSecondary && (
            <button
              className="btn btn--ghost"
              onClick={onSecondary}
              type="button"
            >
              Ver mis pedidos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
