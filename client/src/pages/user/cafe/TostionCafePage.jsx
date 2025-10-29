import React from "react";
import { motion } from "framer-motion";
import { Flame, Thermometer, Timer, Gauge, Coffee } from "lucide-react";

/** ===== Datos estáticos: sin backend ===== */
const ROAST_LEVELS = [
  {
    title: "Claro (City)",
    icon: Coffee,
    notes:
      "Acidez alta, dulzor medio, cuerpo ligero. Ideal para filtrados (V60, Chemex, Kalita).",
    range: "Color claro • primer crack reciente",
  },
  {
    title: "Medio (City+ / Full City)",
    icon: Coffee,
    notes:
      "Balance acidez–dulzor, cuerpo medio. Versátil: filtrados y espresso moderno.",
    range: "Post 1er crack • sin aceites visibles",
  },
  {
    title: "Medio-oscuro (Full City+)",
    icon: Coffee,
    notes:
      "Menos acidez, más caramelo/chocolate; cuerpo alto. Espresso clásico, prensa.",
    range: "Cerca del 2º crack • aceites muy tenues",
  },
  {
    title: "Oscuro (Vienna / French)",
    icon: Coffee,
    notes:
      "Tostado dominante, amargor notable; cuerpo pesado. Espresso intenso y bebidas con leche.",
    range: "Aceites visibles • notas ahumadas",
  },
];

const STAGES = [
  {
    step: "Carga y secado",
    icon: Thermometer,
    temp: "Tambor 190–205 °C (ref.)",
    signals: "Chirrido leve; grano verde → amarillento (evaporación).",
    goal: "Secar sin ‘hornear’; base estable para Maillard.",
  },
  {
    step: "Maillard",
    icon: Gauge,
    temp: "Grano ~140–160 °C",
    signals: "Aromas pan/tostado; color canela.",
    goal: "Construir dulzor/cuerpo (precursores).",
  },
  {
    step: "Primer crack",
    icon: Flame,
    temp: "Grano ~196–203 °C",
    signals: "‘Pops’ audibles; expansión y CO₂.",
    goal: "Marcar inicio de Desarrollo (DTR).",
  },
  {
    step: "Desarrollo",
    icon: Timer,
    temp: "Grano 205–215 °C+ (según objetivo)",
    signals: "Equilibrio acidez-dulzor-cuerpo.",
    goal: "Definir nivel (City / City+ / Full City…).",
  },
  {
    step: "Enfriado",
    icon: Thermometer,
    temp: "Rápido a ambiente",
    signals: "Corte térmico limpio.",
    goal: "Preservar volátiles; evitar horneado.",
  },
];

const QUICK_STATS = [
  { icon: Thermometer, label: "Carga (tambor)", value: "190–205 °C" },
  { icon: Timer, label: "DTR recomendado", value: "15–25 % del total" },
  { icon: Gauge, label: "Duración típica", value: "8–12 min (ref.)" },
];

/** ===== UI atómica (reutiliza tus estilos base) ===== */
const Kicker = ({ children }) => (
  <span className="badge rt-badge">{children}</span>
);

const StatChip = ({ icon: Icon, label, value }) => (
  <div className="card rt-chip">
    <div className="rt-chip__head">
      <Icon className="rt-icon" size={16} />
      <p className="muted rt-chip__label">{label}</p>
    </div>
    <p className="rt-chip__value">{value}</p>
  </div>
);

const FeatureCard = ({ icon: Icon, title, notes, range }) => (
  <motion.article
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.35 }}
    className="card rt-feature"
  >
    <div className="rt-feature__head">
      <span className="rt-icon-wrap" aria-hidden>
        <Icon className="rt-icon" size={18} />
      </span>
      <h3 className="rt-feature__title">{title}</h3>
    </div>
    <p className="muted rt-feature__body">{notes}</p>
    <p className="rt-feature__range">Rango: {range}</p>
  </motion.article>
);

const StageRow = ({ s, index }) => {
  const Icon = s.icon;
  return (
    <div className="card rt-stage">
      <div className="rt-stage__col rt-stage__col--title">
        <span className="rt-icon-wrap" aria-hidden>
          <Icon className="rt-icon" size={18} />
        </span>
        <p className="rt-stage__title">
          {index + 1}. {s.step}
        </p>
      </div>
      <div className="rt-stage__col">
        <p className="rt-stage__label">Temperatura</p>
        <p className="rt-stage__value">{s.temp}</p>
      </div>
      <div className="rt-stage__col">
        <p className="rt-stage__label">Señales</p>
        <p className="rt-stage__value">{s.signals}</p>
      </div>
      <div className="rt-stage__col">
        <p className="rt-stage__label">Objetivo</p>
        <p className="rt-stage__value">{s.goal}</p>
      </div>
    </div>
  );
};

/** Banda de color (roast strip) */
const RoastStrip = () => (
  <div className="card rt-strip" aria-label="Escala visual de tostión">
    <div className="rt-strip__bar" />
    <div className="rt-strip__labels">
      <span>Claro</span>
      <span>Medio</span>
      <span>Medio-oscuro</span>
      <span>Oscuro</span>
    </div>
  </div>
);

/** Curva SVG (mock) */
const RoastCurve = () => (
  <div
    className="card rt-curve"
    aria-label="Curva de tostión (ejemplo ilustrativo)"
  >
    <svg viewBox="0 0 600 280" className="rt-curve__svg" aria-hidden>
      <defs>
        <linearGradient id="rtg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="600" height="280" fill="url(#rtg)" />
      {/* Ejes simples */}
      <g stroke="currentColor" opacity="0.35">
        <line x1="40" y1="240" x2="580" y2="240" />
        <line x1="40" y1="40" x2="40" y2="240" />
      </g>
      {/* Curva: TP -> Maillard -> 1C -> Desarrollo */}
      <path
        d="M40 220 C 120 260, 160 200, 220 180
           S 320 160, 340 150
           S 380 140, 400 120
           S 460 110, 520 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Marcadores de eventos */}
      <g fill="currentColor">
        <circle cx="220" cy="180" r="3" />
        <text x="228" y="176" fontSize="10" fill="currentColor">
          Maillard
        </text>
        <circle cx="380" cy="140" r="3" />
        <text x="388" y="136" fontSize="10" fill="currentColor">
          1er crack
        </text>
        <circle cx="520" cy="100" r="3" />
        <text x="528" y="96" fontSize="10" fill="currentColor">
          Fin desarrollo
        </text>
      </g>
      {/* Leyendas ejes */}
      <text x="8" y="48" fontSize="10" fill="currentColor">
        Temp
      </text>
      <text x="560" y="255" fontSize="10" fill="currentColor">
        Tiempo
      </text>
    </svg>
    <p className="muted rt-curve__note">
      Ejemplo ilustrativo. Ajusta según tu máquina (carga, flujo de aire, gas) y
      origen.
    </p>
  </div>
);

export default function CafeTostionPage() {
  return (
    <main className="origen-page theme--tostion" aria-labelledby="roast-title">
      <div className="container">
        {/* Hero */}
        <header className="hero">
          <Kicker>Tostión de café</Kicker>
          <h1 id="roast-title" className="hero__title">
            Perfiles y etapas de tostión
          </h1>
          <p className="hero__subtitle">
            Guía visual para entender niveles (claro → oscuro), fases térmicas y
            métricas clave (DTR/RoR). Valores orientativos; ajusta según equipo
            y origen.
          </p>
        </header>

        {/* Indicadores rápidos */}
        <section className="grid block" aria-label="Indicadores">
          {QUICK_STATS.map((s, i) => (
            <StatChip key={i} icon={s.icon} label={s.label} value={s.value} />
          ))}
        </section>

        {/* Banda de color y curva */}
        <section className="grid block" aria-label="Visualizaciones">
          <RoastStrip />
          <RoastCurve />
        </section>

        {/* Niveles de tostión */}
        <section className="block" aria-label="Niveles de tostión">
          <h2 className="block__title">Niveles de tostión</h2>
          <div className="grid rt-grid--levels">
            {ROAST_LEVELS.map((r) => (
              <FeatureCard
                key={r.title}
                icon={r.icon}
                title={r.title}
                notes={r.notes}
                range={r.range}
              />
            ))}
          </div>
        </section>

        {/* Etapas / Curva (resumen) */}
        <section className="block" aria-label="Curva de tostión (resumen)">
          <h2 className="block__title">Fases de la curva</h2>
          <div className="rt-stages">
            {STAGES.map((s, i) => (
              <StageRow key={s.step} s={s} index={i} />
            ))}
          </div>
          <p className="muted rt-footnote">
            * Enfriado rápido evita “horneado”. Para espresso, reposo típico
            24–72 h.
          </p>
        </section>
      </div>
    </main>
  );
}
