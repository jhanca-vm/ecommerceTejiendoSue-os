export default function RealisticCelebrationSVG({ width = 260, height = 170 }) {
  /* ====== PALMA (abanico) ====== */
  const CX = 140,
    CY = 110;
  const R_IN = 24,
    R_OUT = 128; // radio externo grande → abanico abierto
  const BLADES = 31; // densidad de hojas
  const START = (-160 * Math.PI) / 180; // abre desde la izquierda
  const END = (-20 * Math.PI) / 180; // hasta la derecha
  const STEP = (END - START) / (BLADES - 1);

  const blades = Array.from({ length: BLADES }, (_, i) => {
    const a = START + i * STEP;
    const ax = CX + R_IN * Math.cos(a);
    const ay = CY + R_IN * Math.sin(a);
    const tx = CX + R_OUT * Math.cos(a);
    const ty = CY + R_OUT * Math.sin(a);

    const w = 5.5; // ancho base
    const nx = Math.cos(a + Math.PI / 2);
    const ny = Math.sin(a + Math.PI / 2);

    const bx1 = ax + nx * w,
      by1 = ay + ny * w;
    const bx2 = ax - nx * w,
      by2 = ay - ny * w;

    // curvatura sutil
    const cx1 = (ax + tx) / 2 + nx * 7,
      cy1 = (ay + ty) / 2 + ny * 7;
    const cx2 = (ax + tx) / 2 - nx * 7,
      cy2 = (ay + ty) / 2 - ny * 7;

    return `M ${bx1.toFixed(1)} ${by1.toFixed(1)}
            Q ${cx1.toFixed(1)} ${cy1.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(
      1
    )}
            Q ${cx2.toFixed(1)} ${cy2.toFixed(1)} ${bx2.toFixed(
      1
    )} ${by2.toFixed(1)} Z`;
  });

  /* ====== SOMBRERO (más volumen en la copa) ====== */
  const brim = { cx: 140, cy: 128, rx: 88, ry: 23 }; // ala (ry↑ = menos aplastado)
  const crownTopY = 94; // ↓ valor menor = cúpula más alta
  const crown = { left: 102, right: 178, baseY: 116, topY: crownTopY };

  // aros del tejido del ala
  const ringRadii = [0.92, 0.8, 0.68, 0.56, 0.44].map((f) => ({
    rx: brim.rx * f,
    ry: brim.ry * (f * 0.98),
  }));

  // vetas verticales (tejido) en la copa — llegan más alto
  const ribs = Array.from({ length: 11 }, (_, i) => {
    const t = -0.9 + i * (1.8 / 10); // de -0.9 a 0.9
    const x1 = 140 + t * 26;
    const x2 = 140 + t * 8;
    const y1 = crown.baseY + 1.5;
    const y2 = crown.topY;
    const cx = (x1 + x2) / 2 + t * 3.5;
    const cy = (y1 + y2) / 2 - 6;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(
      1
    )} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  });

  return (
    <div
      aria-hidden="true"
      style={{ width, height, display: "grid", placeItems: "center" }}
    >
      <style>{`
        .rc6 { display:block; width:100%; height:100%; }
        /* Aparición: palma → sombrero */
        .rc6-palm { opacity:0; transform:translateY(6px) scale(.985); animation: rc6-in .6s ease-out forwards; }
        .rc6-hat  { opacity:0; transform:translateY(4px) scale(.97);  animation: rc6-in .36s ease-out .6s forwards; }
        @keyframes rc6-in { to { opacity:1; transform:none; } }

        /* Estilos */
        .rc6-leaf { fill:url(#rc6Leaf); stroke:#1e3721; stroke-opacity:.14; stroke-width:.6; }
        .rc6-ring { fill:none; stroke:#a98257; stroke-opacity:.35; stroke-width:1; }
        .rc6-rib  { fill:none; stroke:#a17d55; stroke-width:.9; stroke-linecap:round; opacity:.65; }
        .rc6-band { fill:url(#rc6Band); }

        @media (prefers-reduced-motion: reduce) {
          .rc6-palm, .rc6-hat { animation:none; opacity:1; transform:none; }
        }
      `}</style>

      <svg
        className="rc6"
        viewBox="0 0 280 180"
        role="img"
        aria-label="Palma de iraca detrás y sombrero artesanal con volumen"
      >
        <defs>
          <linearGradient id="rc6Leaf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2e4a2d" />
            <stop offset="1" stopColor="#1f3a22" />
          </linearGradient>
          <radialGradient id="rc6Crown" cx="50%" cy="36%" r="72%">
            <stop offset="0" stopColor="#f3e6cf" />
            <stop offset="1" stopColor="#c6a67a" />
          </radialGradient>
          <linearGradient id="rc6Brim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d6b690" />
            <stop offset="1" stopColor="#b3895f" />
          </linearGradient>
          <linearGradient id="rc6Band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8b1b1b" />
            <stop offset="1" stopColor="#b82424" />
          </linearGradient>

          {/* Sombra suave bajo el ala */}
          <filter id="rc6Shadow" x="-30%" y="-30%" width="160%" height="160%">
            {/* JSX: floodOpacity (no flood-opacity) */}
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2.2"
              floodOpacity="0.25"
            />
          </filter>
        </defs>

        {/* PALMA (atrás, abanico abierto) */}
        <g className="rc6-palm">
          {blades.map((d, i) => (
            <path key={i} d={d} className="rc6-leaf" />
          ))}
        </g>

        {/* SOMBRERO (frente, con más volumen) */}
        <g className="rc6-hat" filter="url(#rc6Shadow)">
          {/* Ala */}
          <ellipse
            cx={brim.cx}
            cy={brim.cy}
            rx={brim.rx}
            ry={brim.ry}
            fill="url(#rc6Brim)"
          />
          {/* Aros del ala */}
          {ringRadii.map((r, i) => (
            <ellipse
              key={i}
              cx={brim.cx}
              cy={brim.cy}
              rx={r.rx}
              ry={r.ry}
              className="rc6-ring"
            />
          ))}

          {/* Copa — control points ajustados para MÁS CURVATURA */}
          <path
            d={`
              M ${crown.left} ${crown.baseY}
              C ${crown.left + 14} ${crown.topY - 4},
                ${crown.right - 14} ${crown.topY - 4},
                ${crown.right} ${crown.baseY}
              C ${crown.right} ${crown.baseY + 10},
                ${crown.left} ${crown.baseY + 10},
                ${crown.left} ${crown.baseY}
              Z
            `}
            fill="url(#rc6Crown)"
          />

          {/* Luz superior (más grande y arriba) */}
          <ellipse
            cx="140"
            cy={crown.topY}
            rx="24"
            ry="9"
            fill="#f7e9d2"
            opacity=".85"
          />

          {/* Banda */}
          <rect
            x="114"
            y={crown.baseY - 1}
            width="52"
            height="7"
            rx="3.5"
            className="rc6-band"
          />

          {/* Vetas de tejido en la copa */}
          {ribs.map((d, i) => (
            <path key={i} d={d} className="rc6-rib" />
          ))}
        </g>
      </svg>
    </div>
  );
}
