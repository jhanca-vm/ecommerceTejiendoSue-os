// blocks/ToastBlock.jsx
import { useEffect, useRef } from "react";

export default function ToastBlock({
  message,
  type = "success",
  actions = [],
  onClose,
  onPause,
  onResume,
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
    <div className="toast-wrap">
      {/* sin aria-live aquí */}
      <div
        ref={ref}
        role="status"
        aria-atomic="true"
        className={`toast toast--${type}`}
        onMouseEnter={() => onPause?.()}
        onFocusCapture={() => onPause?.()}
        onMouseLeave={() => onResume?.()}
        onBlurCapture={() => onResume?.()}
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
