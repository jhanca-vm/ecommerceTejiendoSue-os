import { useEffect, useRef } from "react";

/**
 * Toast accesible con acciones.
 * Props:
 * - message: string
 * - type: "success" | "info" | "warning" | "error"
 * - actions: [{ label: string, onClick?: () => void }]
 * - ariaLive: "polite" | "assertive"
 * - onClose: () => void
 */
export default function ToastBlock({
  message,
  type = "success",
  actions = [],
  ariaLive = "polite",
  onClose,
}) {
  const ref = useRef(null);

  // Cerrar con Esc y click fuera
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [onClose]);

  return (
    <div className="toast-wrap" aria-live={ariaLive}>
      <div
        ref={ref}
        role="status"
        className={`toast toast--${type}`}
        aria-atomic="true"
      >
        <div className="toast__content">
          <span className="toast__msg">{message}</span>
          {actions?.length > 0 && (
            <div className="toast__actions">
              {actions.map((a, i) => (
                <button
                  key={i}
                  className={`toast__btn ${i === 0 ? "primary" : "ghost"}`}
                  onClick={() => {
                    a?.onClick?.();
                    onClose?.();
                  }}
                  type="button"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="toast__close"
          aria-label="Cerrar notificación"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

