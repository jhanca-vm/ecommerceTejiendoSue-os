import React from "react";
import { motion  } from "framer-motion";
import {
  Leaf as Leaf2,
  MapPin as MapPin2,
  Factory as Factory2,
  CheckCircle2 as Check2,
  Sprout as Sprout2,
} from "lucide-react";

/** ==== Datos estáticos (frontend only) ==== */
const panela = {
  title: "Panela de Sandoná (Nariño)",
  kicker: "Caña, tradición y energía natural",
  hero: "En Sandoná, los cañaduzales y los trapiches sostienen una tradición centenaria. La panela conserva melazas y el sabor profundo de la caña: ideal para bebidas, postres y cocina diaria.",
  stats: [
    { label: "Materia prima", value: "Caña de azúcar", icon: Sprout2 },
    {
      label: "Proceso",
      value: "Trapiche artesanal • tren de pailas",
      icon: Factory2,
    },
    { label: "Uso típico", value: "Aguapanela, postres, salsas", icon: Leaf2 },
  ],
  features: [
    {
      title: "Trapiche tradicional",
      desc: "Molienda, clarificación y evaporación hasta el punto de miel; bateo, moldeo y enfriado.",
      icon: Factory2,
    },
    {
      title: "Cultura local",
      desc: "Economía familiar, ruta panelera y visitas a trapiches en veredas sandoneñas.",
      icon: MapPin2,
    },
    {
      title: "Alternativa natural",
      desc: "Endulzante no refinado con melazas propias; carácter y notas caramelizadas.",
      icon: Check2,
    },
  ],
  steps: [
    {
      label: "Corte de caña",
      text: "Selección en madurez óptima para jugo dulce y limpio.",
    },
    {
      label: "Molienda y jugo",
      text: "Trapiche extrae jugo; prelimpieza y clarificación.",
    },
    {
      label: "Evaporación y punto",
      text: "Concentración en pailas hasta miel; punteo y bateo.",
    },
    {
      label: "Moldeo y secado",
      text: "Vertido en moldes, enfriado y reposo antes de empaque.",
    },
  ],
  origin: {
    label: "Origen: Sandoná, Nariño (Colombia)",
    coords: "1.2847°N, -77.4711°W",
  },
  gallery: [
    "https://images.unsplash.com/photo-1594308457822-6fe1cf8194b7?q=80&w=1400", // caña
    "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1400", // panela bloque
    "https://images.unsplash.com/photo-1514516789440-e54181c6b6d3?q=80&w=1400", // trapiche / rural
  ],
  videos: [
    "https://www.youtube.com/embed/hgUj0tKM8OA", // proceso tradicional (TvAgro)
    "https://www.youtube.com/embed/qZ7e4QPwRS0", // cultura/aguapanela
  ],
};

/** ==== UI (reutiliza tus clases globales y añade prefijo pn-) ==== */
const Badge = ({ children }) => <span className="badge">{children}</span>;

const Stat = ({ icon: Icon, label, value }) => (
  <div className="card pn-stat">
    <div className="pn-stat__row">
      <span className="pn-icon-wrap" aria-hidden>
        <Icon className="pn-icon" size={18} />
      </span>
      <div>
        <p className="muted pn-stat__label">{label}</p>
        <p className="pn-stat__value">{value}</p>
      </div>
    </div>
  </div>
);

const FeatureCard = ({ icon: Icon, title, desc }) => (
  <motion.article
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.35 }}
    className="card pn-feature"
  >
    <div className="pn-feature__head">
      <span className="pn-icon-wrap" aria-hidden>
        <Icon className="pn-icon" size={18} />
      </span>
      <h3 className="pn-feature__title">{title}</h3>
    </div>
    <p className="muted">{desc}</p>
  </motion.article>
);

const Timeline = ({ steps }) => (
  <ol className="timeline">
    {steps.map((s, i) => (
      <li key={i}>
        <span className="dot dot--amber">{i + 1}</span>
        <h4 className="pn-step__title">{s.label}</h4>
        <p className="muted">{s.text}</p>
      </li>
    ))}
  </ol>
);

const SoftMap = ({ label, coords }) => (
  <div className="card softmap softmap--amber" role="img" aria-label={label}>
    <div className="pn-softmap__head">
      <MapPin2 size={18} />
      <p className="muted">{label}</p>
    </div>
    <svg viewBox="0 0 600 260" className="pn-softmap__svg" aria-hidden>
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="600" height="260" fill="url(#g2)" />
      <g fill="none" stroke="currentColor" opacity="0.25">
        {Array.from({ length: 9 }).map((_, r) => (
          <path
            key={r}
            d={`M0 ${20 + r * 24} C 180 0, 420 260, 600 ${20 + r * 24}`}
          />
        ))}
      </g>
    </svg>
    <p className="pn-softmap__coords">{coords}</p>
  </div>
);

const Gallery = ({ images }) => (
  <div className="pn-gallery" aria-label="Galería de imágenes">
    {images.map((src, i) => (
      <figure className="card pn-gallery__item" key={i}>
        <img loading="lazy" src={src} alt={`Panela Sandoná ${i + 1}`} />
      </figure>
    ))}
  </div>
);

const VideoGrid = ({ videos }) => (
  <div className="pn-videos" aria-label="Videos de proceso/cultura">
    {videos.map((url, i) => (
      <div className="card pn-video" key={i}>
        <iframe
          loading="lazy"
          src={url}
          title={`Video panela ${i + 1}`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    ))}
  </div>
);

export function PanelaSandonaPage() {
  return (
    <main className="origen-page theme--panela" aria-labelledby="panela-title">
      <div className="container">
        {/* Hero */}
        <header className="hero">
          <p className="kicker">{panela.kicker}</p>
          <h1 id="panela-title" className="hero__title">
            {panela.title}
          </h1>
          <p className="hero__subtitle">{panela.hero}</p>
        </header>

        {/* Stats */}
        <section className="grid" aria-label="Indicadores">
          {panela.stats.map((s, i) => (
            <Stat key={i} icon={s.icon} label={s.label} value={s.value} />
          ))}
        </section>

        {/* Features */}
        <section className="grid block" aria-label="Características">
          <h2 className="block__title">¿Por qué nuestra panela?</h2>
          {panela.features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} />
          ))}
        </section>

        {/* Proceso + Mapa */}
        <section className="grid block" aria-label="Proceso">
          <div>
            <h2 className="block__title">De la caña a la panela</h2>
            <Timeline steps={panela.steps} />
          </div>
          <SoftMap label={panela.origin.label} coords={panela.origin.coords} />
        </section>

        {/* Galería */}
        <section className="block" aria-label="Galería del origen">
          <h2 className="block__title">Galería</h2>
          <Gallery images={panela.gallery} />
        </section>

        {/* Videos */}
        <section className="block" aria-label="Videos">
          <h2 className="block__title">Videos</h2>
          <VideoGrid videos={panela.videos} />
        </section>
      </div>
    </main>
  );
}
