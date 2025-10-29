import { useEffect, useMemo, useState } from "react";

// Número en E.164 sin '+'
const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || "573001234567";
const DEFAULT_MSG = "Hola 👋 Me gustaría recibir ayuda sobre un producto.";

function enc(s) {
  try {
    return encodeURIComponent(s);
  } catch {
    return s;
  }
}
function isMobileUA() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

export default function WhatsAppFab({
  number = WA_NUMBER,
  message = DEFAULT_MSG,
  tooltip = "Chatea por WhatsApp",
  utm = "utm_source=ecommerce&utm_medium=whatsapp_fab&utm_campaign=soporte",
  attachPageUrl = true,
  onTrack,
  className = "",
  // Nuevas opciones de visibilidad:
  trigger = "immediate", // "immediate" | "delay" | "scroll"
  delayMs = 7000, // para trigger="delay"
  scrollPercent = 30, // para trigger="scroll"
  closable = true, // permite cerrar
  rememberCloseKey = "wa_fab_closed_session", // guarda preferencia
}) {
  const [visible, setVisible] = useState(trigger === "immediate");
  const [closed, setClosed] = useState(
    () => sessionStorage.getItem(rememberCloseKey) === "1"
  );

  useEffect(() => {
    if (closed) return;
    if (trigger === "delay") {
      const t = setTimeout(() => setVisible(true), Math.max(0, delayMs));
      return () => clearTimeout(t);
    }
    if (trigger === "scroll") {
      const onScroll = () => {
        const h = document.documentElement;
        const scrolled =
          (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        if (scrolled >= scrollPercent) {
          setVisible(true);
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
  }, [trigger, delayMs, scrollPercent, closed]);

  const payload = useMemo(
    () => ({
      page_path: window.location.pathname,
      page_title: document.title,
      device: isMobileUA() ? "mobile" : "desktop",
    }),
    []
  );

  const href = useMemo(() => {
    const extra = attachPageUrl ? `\n\nEstoy en: ${window.location.href}` : "";
    const text = enc(`${message}${extra}`);
    const base = `https://wa.me/${number}?text=${text}`;
    return utm ? `${base}&${utm}` : base;
  }, [number, message, utm, attachPageUrl]);

  const onClick = (e) => {
    if (onClick._locked) {
      e.preventDefault();
      return;
    }
    onClick._locked = true;
    setTimeout(() => (onClick._locked = false), 800);
    try {
      onTrack?.(payload);
    } catch (_) {}
  };

  const onClose = () => {
    setClosed(true);
    sessionStorage.setItem(rememberCloseKey, "1");
  };

  if (!visible || closed) return null;

  return (
    <div className={`wa-fab-wrap ${className}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={tooltip}
        className="wa-fab"
        onClick={onClick}
      >
        {/* Ícono WhatsApp */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          width="28"
          height="28"
          aria-hidden="true"
        >
          <path
            d="M19.11 17.06c-.27-.13-1.58-.77-1.83-.86-.24-.09-.42-.13-.6.13-.18.27-.69.86-.85 1.04-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.34-.79-.7-1.32-1.57-1.48-1.83-.16-.27-.02-.41.11-.54.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.6-1.44-.82-1.97-.22-.53-.44-.45-.6-.46-.16-.01-.34-.01-.52-.01-.18 0-.47.07-.72.34-.24.27-.94.92-.94 2.24s.97 2.6 1.11 2.78c.13.18 1.92 2.93 4.66 4.06.65.28 1.15.45 1.54.58.65.21 1.25.18 1.72.11.53-.08 1.58-.64 1.81-1.27.22-.63.22-1.17.15-1.28-.07-.11-.24-.18-.51-.31z"
            fill="currentColor"
          />
          <path
            d="M27 15.06C27 9.53 22.47 5 16.94 5 11.4 5 6.87 9.53 6.87 15.06c0 2.08.62 4.02 1.69 5.63L7 27l6.53-1.52c1.55.85 3.32 1.34 5.22 1.34C22.47 26.82 27 22.58 27 15.06zM16.76 24.1c-1.72 0-3.31-.5-4.64-1.35l-.33-.21-3.88.9.83-3.77-.22-.35a8.2 8.2 0 0 1-1.29-4.46c0-4.61 3.76-8.37 8.37-8.37s8.37 3.76 8.37 8.37-3.76 8.24-8.21 8.24z"
            fill="currentColor"
          />
        </svg>
        <span className="wa-fab__sr">WhatsApp</span>
      </a>

      {closable && (
        <button
          type="button"
          className="wa-fab-close"
          aria-label="Cerrar WhatsApp"
          onClick={onClose}
        >
          ×
        </button>
      )}
    </div>
  );
}
