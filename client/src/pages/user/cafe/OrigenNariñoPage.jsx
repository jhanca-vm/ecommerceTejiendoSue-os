import React from "react";
import { motion } from "framer-motion";
import {
  Coffee,
  Leaf,
  Droplet,
  Sun,
  Mountain,
  ShieldCheck,
  MapPin,
} from "lucide-react";

/** ===== Datos del origen (editable) ===== */
const cafe = {
  title: "Café de Sandoná (Nariño)",
  kicker: "Denominación de Origen • Altura y suelos volcánicos",
  hero: "Crecido en laderas del Galeras a ~1.850–2.200 m s. n. m., con días templados y noches frías que favorecen una maduración lenta. Taza limpia, acidez vivaz y dulzor a panela.",
  stats: [
    {
      label: "Altitud típica",
      value: "1.850–2.200 m s. n. m.",
      icon: Mountain,
    },
    {
      label: "Proceso",
      value: "Lavado • Honey (lotes especiales)",
      icon: Droplet,
    },
    { label: "Notas comunes", value: "Cítricos, panela, floral", icon: Coffee },
    { label: "Productor", value: "Pequeños caficultores", icon: Leaf },
  ],
  features: [
    {
      title: "Denominación de Origen Nariño",
      desc: "Microclimas andinos y suelos volcánicos; rango térmico diurno que impulsa acidez brillante y dulzor limpio.",
      icon: ShieldCheck,
    },
    {
      title: "Microclimas y trazabilidad",
      desc: "Lotes por vereda/finca; recolección manual selectiva y beneficio cuidadoso para consistencia en taza.",
      icon: Sun,
    },
    {
      title: "Extracciones recomendadas",
      desc: "V60 y Chemex para resaltar claridad; espresso para una acidez cítrica elegante y final dulce.",
      icon: Coffee,
    },
  ],
  steps: [
    {
      label: "Cosecha selectiva",
      text: "Sólo cerezas maduras, en pasadas escalonadas.",
    },
    {
      label: "Beneficio controlado",
      text: "Fermentación medida; lavado con agua limpia de montaña.",
    },
    {
      label: "Secado lento",
      text: "Marquesinas / camas elevadas para preservar aroma.",
    },
    {
      label: "Tostión de perfil",
      text: "Medio a medio-claro para acidez y dulzor balanceados.",
    },
  ],
  origin: {
    label: "Origen: Sandoná, Cordillera de los Andes (Nariño)",
    coords: "1.2847°N, -77.4711°W",
  },
  gallery: [
    // Reemplaza por tus propias imágenes (p. ej. /assets/cafe/sandona-01.jpg)
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1400",
    "https://images.unsplash.com/photo-1498804103079-a6351b050096?q=80&w=1400",
    "https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?q=80&w=1400",
  ],
  videos: [
    // Reemplaza con tus videos reales
    "https://www.youtube.com/embed/VIDEO_ID_1",
    "https://www.youtube.com/embed/VIDEO_ID_2",
  ],
};

/** ===== UI atómica (reutiliza tus clases globales) ===== */
const Badge = ({ children }) => <span className="badge">{children}</span>;

const Stat = ({ icon: Icon, label, value }) => (
  <div className="card stat">
    <div className="sdn-stat-row">
      <span className="sdn-icon-wrap" aria-hidden>
        <Icon className="sdn-icon" size={20} />
      </span>
      <div className="sdn-stat-body">
        <p className="muted">{label}</p>
        <p className="sdn-value">{value}</p>
      </div>
    </div>
  </div>
);

const FeatureCard = ({ icon: Icon, title, desc }) => (
  <motion.article
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.35 }}
    className="card feature sdn-feature"
  >
    <div className="sdn-feature-head">
      <span className="sdn-icon-wrap" aria-hidden>
        <Icon className="sdn-icon" size={20} />
      </span>
      <h3 className="sdn-feature-title">{title}</h3>
    </div>
    <p className="muted">{desc}</p>
  </motion.article>
);

const Timeline = ({ steps }) => (
  <ol className="timeline">
    {steps.map((s, i) => (
      <li key={i}>
        <span className="dot dot--emerald">{i + 1}</span>
        <h4 className="sdn-step-title">{s.label}</h4>
        <p className="muted">{s.text}</p>
      </li>
    ))}
  </ol>
);

const SoftMap = ({ label, coords }) => (
  <div className="card softmap softmap--emerald">
    <div className="sdn-softmap-head">
      <MapPin size={18} />
      <p className="muted">{label}</p>
    </div>
    <svg viewBox="0 0 600 260" className="sdn-softmap-svg" aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="600" height="260" fill="url(#g1)" />
      <g fill="none" stroke="currentColor" opacity="0.25">
        {Array.from({ length: 9 }).map((_, r) => (
          <path
            key={r}
            d={`M0 ${20 + r * 24} C 180 0, 420 260, 600 ${20 + r * 24}`}
          />
        ))}
      </g>
    </svg>
    <p className="sdn-softmap-coords">{coords}</p>
  </div>
);

const Gallery = ({ images }) => (
  <div className="sdn-gallery" aria-label="Galería de imágenes">
    {images.map((src, idx) => (
      <figure className="sdn-gallery-item card" key={idx}>
        <img loading="lazy" src={src} alt={`Café de Sandoná ${idx + 1}`} />
      </figure>
    ))}
  </div>
);

const VideoGrid = ({ videos }) => (
  <div className="sdn-videos" aria-label="Videos del origen">
    {videos.map((url, idx) => (
      <div className="sdn-video card" key={idx}>
        <iframe
          loading="lazy"
          src={url}
          title={`Video café Sandoná ${idx + 1}`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    ))}
  </div>
);

/** ===== Página ===== */
export default function CafeSandonaPage() {
  return (
    <main className="origen-page theme--sandona" aria-labelledby="cafe-title">
      <div className="container">
        {/* Hero */}
        <header className="hero">
          <p className="kicker">{cafe.kicker}</p>
          <h1 id="cafe-title" className="hero__title">
            {cafe.title}
          </h1>
          <p className="hero__subtitle">{cafe.hero}</p>
        </header>

        {/* Indicadores */}
        <section className="grid" aria-label="Indicadores">
          {cafe.stats.map((s, i) => (
            <Stat key={i} icon={s.icon} label={s.label} value={s.value} />
          ))}
        </section>

        {/* Características */}
        <section className="grid block" aria-label="Características">
          <h2 className="block__title">¿Por qué Sandoná?</h2>
          {cafe.features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} />
          ))}
        </section>

        {/* Proceso + Mapa */}
        <section className="grid block" aria-label="Proceso">
          <div>
            <h2 className="block__title">Del grano a la taza</h2>
            <Timeline steps={cafe.steps} />
          </div>
          <SoftMap label={cafe.origin.label} coords={cafe.origin.coords} />
        </section>

        {/* Galería */}
        <section className="block" aria-label="Galería del origen">
          <h2 className="block__title">Galería del origen</h2>
          <Gallery images={cafe.gallery} />
        </section>

        {/* Videos */}
        <section className="block" aria-label="Videos">
          <h2 className="block__title">Videos</h2>
          <VideoGrid videos={cafe.videos} />
        </section>
      </div>
    </main>
  );
}
