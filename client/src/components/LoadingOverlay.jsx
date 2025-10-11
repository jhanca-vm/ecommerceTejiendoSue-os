// src/components/LoadingOverlay.jsx
import { createPortal } from "react-dom";
import { useLoading } from "../contexts/LoadingContext";

export default function LoadingOverlay({
  message = "Preparando tu experiencia…",
  showCounter = false,
  minWidth = 280,
}) {
  const { isLoading, pending } = useLoading();
  if (!isLoading) return null;

  const body = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        // FONDO OSCURO + desenfoque + viñeta
        background:
          "radial-gradient(1200px 800px at 50% 30%, rgba(6,8,12,.70), rgba(6,8,12,.88))",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          minWidth,
          maxWidth: 380,
          width: "calc(100% - 40px)",
          display: "grid",
          gap: 12,
          justifyItems: "center",
          padding: "18px 22px",
          borderRadius: 18,
          // CARD OSCURA (glassmorphism)
          background:
            "linear-gradient(180deg, rgba(17,24,39,.78), rgba(17,24,39,.72))",
          color: "#E5E7EB",
          boxShadow:
            "0 14px 44px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06), inset 0 -1px 0 rgba(0,0,0,.4)",
          border: "1px solid rgba(255,255,255,.12)",
          WebkitBackdropFilter: "blur(10px)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ height: 82 }}>
          <HatSVG />
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#F3F4F6",
            textAlign: "center",
            lineHeight: 1.35,
            padding: "2px 4px",
          }}
        >
          {message} {showCounter && pending > 1 ? `(${pending})` : ""}
        </div>

        {/* Barra indeterminada */}
        <div
          style={{
            width: "100%",
            height: 4,
            borderRadius: 9999,
            background: "rgba(243,244,246,.10)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              transform: "translateX(-100%)",
              animation: "loader-stripe 1.1s ease-in-out infinite",
              background:
                "linear-gradient(90deg, transparent, rgba(14,165,233,.55), transparent)",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 11,
            opacity: 0.85,
            letterSpacing: ".2px",
            color: "#9CA3AF",
          }}
        >
          Tejiendo Sueños · artesanías, panela & café
        </div>

        <style>{`
          @keyframes loader-stripe {
            from { transform: translateX(-100%); }
            to   { transform: translateX(100%); }
          }
          @keyframes hat-wiggle {
            0%   { transform: translateY(0) rotate(0); }
            25%  { transform: translateY(-1.5px) rotate(-5deg); }
            50%  { transform: translateY(0) rotate(0); }
            75%  { transform: translateY(-1.5px) rotate(5deg); }
            100% { transform: translateY(0) rotate(0); }
          }
          @keyframes weave-run {
            to { stroke-dashoffset: -300; }
          }
          @keyframes band-pulse {
            0%,100% { opacity: .85; }
            50%     { opacity: 1;   }
          }
          @media (prefers-reduced-motion: reduce) {
            svg.hat-anim, [style*="loader-stripe"] {
              animation: none !important;
              transform: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function HatSVG() {
  return (
    <svg
      className="hat-anim"
      width="96"
      height="82"
      viewBox="0 0 512 420"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        display: "block",
        animation: "hat-wiggle 1.15s ease-in-out infinite",
        transformOrigin: "50% 70%",
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,.55))",
      }}
    >
      <defs>
        <linearGradient id="gold1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4E2B8" />
          <stop offset="100%" stopColor="#C9A45A" />
        </linearGradient>
        <linearGradient id="gold2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F4E2B8" />
          <stop offset="100%" stopColor="#B7893F" />
        </linearGradient>
        <linearGradient id="bandBlue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="weaveStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E7C98A" />
          <stop offset="100%" stopColor="#C99F53" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor="rgba(0,0,0,.5)"
          />
        </filter>
        <filter id="innerSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Ala (tejido animado) */}
      <g
        fill="none"
        stroke="url(#weaveStroke)"
        strokeLinecap="round"
        opacity="0.95"
        strokeDasharray="22 16"
        strokeDashoffset="0"
        style={{ animation: "weave-run 2.6s linear infinite" }}
      >
        <ellipse cx="256" cy="344" rx="160" ry="41" strokeWidth="10" />
        <ellipse cx="256" cy="344" rx="140" ry="36" strokeWidth="9" />
        <ellipse cx="256" cy="344" rx="120" ry="31" strokeWidth="8" />
        <ellipse cx="256" cy="344" rx="100" ry="26" strokeWidth="7" />
        <ellipse cx="256" cy="344" rx="80" ry="21" strokeWidth="6" />
        <ellipse cx="256" cy="344" rx="60" ry="16" strokeWidth="5" />
      </g>

      {/* Cinta */}
      <ellipse
        cx="256"
        cy="330"
        rx="88"
        ry="14"
        fill="url(#bandBlue)"
        opacity="0.95"
        style={{ animation: "band-pulse 1.8s ease-in-out infinite" }}
      />

      {/* Copa */}
      <g filter="url(#softShadow)">
        <path
          d="M196,224 C196,204 212,188 232,188 L280,188 C300,188 316,204 316,224 L316,300 C316,312 306,322 294,322 L218,322 C206,322 196,312 196,300 Z"
          fill="url(#gold1)"
        />
        <rect x="206" y="198" width="100" height="14" rx="7" fill="#EBD8A2" />
        <path
          d="M200,224 L312,224 L312,300 C312,310 304,318 294,318 L218,318 C208,318 200,310 200,300 Z"
          fill="rgba(0,0,0,0.22)"
          filter="url(#innerSoft)"
        />
      </g>

      {/* Unión copa-ala */}
      <ellipse
        cx="256"
        cy="324"
        rx="96"
        ry="18"
        fill="url(#gold2)"
        opacity="0.7"
      />
    </svg>
  );
}
