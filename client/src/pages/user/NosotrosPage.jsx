import React from "react";

const stats = [
  { label: "Artesanos vinculados", value: "120+" },
  { label: "Productos únicos", value: "850+" },
  { label: "Comunidades impactadas", value: "7" },
  { label: "Años tejiendo raíces", value: "10+" },
];

const valores = [
  {
    title: "Autenticidad",
    desc: "Cada pieza cuenta una historia real del territorio.",
  },
  {
    title: "Sostenibilidad",
    desc: "Materiales responsables y comercio justo.",
  },
  {
    title: "Calidad",
    desc: "Acabados finos y control de cada etapa del proceso.",
  },
  {
    title: "Innovación",
    desc: "Personalización láser y sublimación con identidad local.",
  },
];

const pasosArtesania = [
  {
    n: "01",
    t: "Selección de materia prima",
    d: "Paja toquilla (iraca) seleccionada por calibre, color y flexibilidad.",
  },
  {
    n: "02",
    t: "Tejido a mano",
    d: "Técnicas tradicionales heredadas, puntadas firmes y uniformes.",
  },
  {
    n: "03",
    t: "Formado y acabado",
    d: "Modelado, limpieza de fibras, alisado y protección.",
  },
  {
    n: "04",
    t: "Personalización",
    d: "Grabado láser, bordado o sublimación bajo pedido.",
  },
];

const categorias = [
  "Artesanías en paja toquilla",
  "Panela y derivados",
  "Café de origen",
  "Personalizados: láser & sublimación",
];

export default function NosotrosPage() {
  return (
    <main className="about">
      {/* Hero */}
      <section className="about__hero">
        <div className="about__hero-inner">
          <h1 className="about__title">
            Tejiendo Raíces
            <span className="about__title-accent"> • Hecho en comunidad</span>
          </h1>
          <p className="about__subtitle">
            Rescatamos oficios, impulsamos economía local y llevamos identidad
            nariñense al mundo a través de artesanías en paja toquilla, panela,
            café de origen y productos personalizados.
          </p>

          <div className="about__chips">
            {categorias.map((c) => (
              <span className="chip" key={c}>
                {c}
              </span>
            ))}
          </div>

          <div className="about__cta">
            <a href="/categoria/tienda" className="btn btn--brand">
              Ver catálogo
            </a>
            <a href="/contacto" className="btn btn--ghost">
              Contáctanos
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="about__stats container">
        {stats.map((s) => (
          <article className="stat" key={s.label}>
            <div className="stat__value">{s.value}</div>
            <div className="stat__label">{s.label}</div>
          </article>
        ))}
      </section>

      {/* Historia */}
      <section className="about__story container">
        <div className="about__story-text">
          <h2>De Sandoná para el mundo</h2>
          <p>
            Nacimos en Sandoná, Nariño, cuna del tejido en paja toquilla.
            Nuestro propósito es conectar el trabajo de maestras y maestros
            artesanos con personas que valoran la autenticidad. Creemos en un
            comercio que honra el tiempo, el detalle y la cultura.
          </p>
          <p>
            Ampliamos nuestro tejido al dulce de la panela y al café especial,
            seleccionando aliados que comparten nuestra visión de trazabilidad,
            calidad y respeto por la tierra.
          </p>
        </div>
        <div className="about__story-media" aria-hidden="true">
          {/* Reemplaza por tu imagen */}
          <div className="media-skeleton">Imagen/Taller</div>
        </div>
      </section>

      {/* Valores */}
      <section className="about__values container">
        <h2>Nuestros valores</h2>
        <div className="about__values-grid">
          {valores.map((v) => (
            <article className="value" key={v.title}>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Oficio / Proceso */}
      <section className="about__craft container">
        <div className="about__craft-head">
          <h2>Del hilo a la pieza</h2>
          <p>
            Acompañamos cada etapa: selección de fibras, tejido, formado,
            terminados y personalización con láser o sublimación.
          </p>
        </div>
        <div className="about__steps">
          {pasosArtesania.map((p) => (
            <article className="step" key={p.n}>
              <span className="step__n">{p.n}</span>
              <h3 className="step__t">{p.t}</h3>
              <p className="step__d">{p.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Sostenibilidad */}
      <section className="about__sustain container">
        <div className="card">
          <h2>Sostenibilidad e impacto</h2>
          <ul className="bullets">
            <li>
              Compra directa y precios justos para artesanos y productores.
            </li>
            <li>
              Fibras naturales, empaques reciclables y producción responsable.
            </li>
            <li>Capacitación continua y relevo generacional del oficio.</li>
            <li>Trazabilidad en panela y café; lotes y perfiles definidos.</li>
          </ul>
        </div>
      </section>

      {/* Personalización */}
      <section className="about__custom container">
        <div className="about__custom-grid">
          <div>
            <h2>Personalización con identidad</h2>
            <p>
              Integramos tecnología para ampliar posibilidades: grabado láser
              (acero, madera, cuero) y sublimación (textil, mugs,
              merchandising). Personaliza eventos, marcas y regalos
              corporativos.
            </p>
            <div className="about__badges">
              <span className="badge">Grabado láser</span>
              <span className="badge">Sublimación</span>
              <span className="badge">Bordado</span>
            </div>
            <div className="about__cta">
              <a href="/personalizados" className="btn btn--brand">
                Ver personalizados
              </a>
            </div>
          </div>
          <div aria-hidden="true" className="about__custom-media">
            <div className="media-skeleton">Láser/Sublimación</div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="about__final">
        <div className="about__final-inner container">
          <h2>¿Te ayudamos a diseñar tu pieza?</h2>
          <p>
            Escríbenos y construyamos juntos productos que conserven la
            tradición y eleven tu marca.
          </p>
          <div className="about__cta">
            <a href="/contacto" className="btn btn--brand">
              Hablar con asesor
            </a>
            <a href="/categoria/tienda" className="btn btn--ghost">
              Explorar catálogo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
