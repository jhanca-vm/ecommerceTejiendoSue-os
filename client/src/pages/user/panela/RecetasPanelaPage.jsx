import React from "react";

/** Puedes extender recetas aquí sin backend */
const RECIPES = [
  // --- Bebidas ---
  {
    id: "aguapanela-caliente",
    category: "Bebidas",
    title: "Aguapanela caliente clásica",
    time: "10 min",
    servings: "2–3",
    difficulty: "Fácil",
    tags: ["Tradicional", "Energética"],
    img: "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?q=80&w=1200",
    ingredients: [
      "1 litro de agua",
      "120 g de panela (ajusta al gusto)",
      "1 astilla pequeña de canela",
      "Opcional: unas gotas de limón",
    ],
    steps: [
      "Calienta el agua con la canela hasta hervir.",
      "Agrega la panela y mezcla hasta disolver.",
      "Sirve. Si usas limón, añádelo fuera del fuego.",
    ],
    note: "Añadir el limón al final ayuda a preservar su vitamina C.",
  },
  {
    id: "aguapanela-fria-limon",
    category: "Bebidas",
    title: "Aguapanela fría con limón",
    time: "15 min + frío",
    servings: "4",
    difficulty: "Fácil",
    tags: ["Refrescante"],
    img: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?q=80&w=1200",
    ingredients: [
      "1 litro de agua",
      "100–120 g de panela",
      "Jugo de 2 limones",
      "Hielo al gusto",
    ],
    steps: [
      "Disuelve la panela en 250 ml de agua caliente.",
      "Mezcla con el agua restante y deja entibiar.",
      "Añade jugo de limón y hielos. Refrigera y sirve frío.",
    ],
    note: "Evita hervir el limón para mantener su frescura.",
  },
  // --- Postres ---
  {
    id: "panelitas-leche",
    category: "Postres",
    title: "Panelitas de leche",
    time: "45 min",
    servings: "≈15 unidades",
    difficulty: "Media",
    tags: ["Dulce tradicional"],
    img: "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?q=80&w=1200",
    ingredients: [
      "500 ml de leche",
      "250 g de panela rallada",
      "1 cda de mantequilla",
      "1 cdita de vainilla",
    ],
    steps: [
      "Calienta la leche con la panela a fuego medio hasta disolver.",
      "Agrega mantequilla y vainilla; cocina mezclando hasta espesar.",
      "Vierte en molde engrasado, deja templar y corta en cuadritos.",
    ],
    note: "Remueve de forma constante para evitar que se pegue.",
  },
  {
    id: "natilla-panela",
    category: "Postres",
    title: "Natilla con panela",
    time: "35 min",
    servings: "6",
    difficulty: "Media",
    tags: ["Navideña"],
    img: "https://images.unsplash.com/photo-1607958996333-41a2b0c3e750?q=80&w=1200",
    ingredients: [
      "1 litro de leche",
      "200 g de panela rallada",
      "100 g de maicena",
      "1 astilla de canela",
      "1 cdita de esencia de vainilla",
      "Pizca de sal",
    ],
    steps: [
      "Disuelve la maicena en 250 ml de leche fría.",
      "Hierve la leche restante con canela y panela hasta disolver.",
      "Retira canela, añade la mezcla de maicena sin dejar de mover.",
      "Cocina a fuego bajo hasta espesar; añade vainilla y sal. Vierte en molde.",
    ],
    note: "Engrasa ligeramente el molde para un desmolde más limpio.",
  },
  // --- Extra sugeridas (mejor presentación) ---
  {
    id: "salsa-panela-citricos",
    category: "Salsas",
    title: "Salsa de panela y cítricos para carnes",
    time: "20 min",
    servings: "4",
    difficulty: "Fácil",
    tags: ["Salada", "Glaseado"],
    img: "https://images.unsplash.com/photo-1512054502228-58e9b91ff028?q=80&w=1200",
    ingredients: [
      "120 g de panela rallada",
      "120 ml de jugo de naranja",
      "2 cdas de jugo de limón",
      "1 cda de salsa de soya",
      "1 cdita de jengibre rallado",
      "Pizca de sal",
    ],
    steps: [
      "Reduce la mezcla a fuego medio hasta espesar (8–12 min).",
      "Rectifica sal. Glasea sobre pollo o cerdo al final de cocción.",
    ],
  },
];

function Badge({ children }) {
  return <span className="badge">{children}</span>;
}
function StatChip({ label }) {
  return (
    <span className="stat-chip" aria-label={label}>
      {label}
    </span>
  );
}
function Tag({ children }) {
  return <span className="tag">{children}</span>;
}

function RecipeCard({ r }) {
  return (
    <article className="card rx-card" id={r.id}>
      {r.img && (
        <figure className="rx-thumb">
          <img src={r.img} alt={r.title} loading="lazy" />
        </figure>
      )}
      <header className="rx-head">
        <div className="rx-labels">
          <Badge>{r.category}</Badge>
          <div className="rx-stats">
            <StatChip label={r.time} />
            <StatChip label={`Rinde: ${r.servings}`} />
            <StatChip label={r.difficulty} />
          </div>
        </div>
        <h3 className="rx-title">{r.title}</h3>
        {r.tags?.length > 0 && (
          <div className="rx-tags" role="list" aria-label="Etiquetas">
            {r.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
      </header>

      <div className="rx-body">
        <section className="rx-sec" aria-labelledby={`${r.id}-ing`}>
          <h4 id={`${r.id}-ing`} className="rx-sec__title">
            Ingredientes
          </h4>
          <ul className="rx-list rx-list--bullets">
            {r.ingredients.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </section>

        <section className="rx-sec" aria-labelledby={`${r.id}-prep`}>
          <h4 id={`${r.id}-prep`} className="rx-sec__title">
            Preparación
          </h4>
          <ol className="rx-list rx-list--steps">
            {r.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
          {r.note && <p className="rx-note">{r.note}</p>}
        </section>
      </div>
    </article>
  );
}

export default function PanelaRecipesPage() {
  const bebidas = RECIPES.filter((r) => r.category === "Bebidas");
  const postres = RECIPES.filter((r) => r.category === "Postres");
  const salsas = RECIPES.filter((r) => r.category === "Salsas");

  return (
    <main
      className="recipes-page recipes--panela"
      aria-labelledby="recipes-title"
    >
      <div className="container">
        {/* Hero */}
        <header className="hero">
          <p className="kicker">Panela</p>
          <h1 id="recipes-title" className="hero__title">
            Recetas con Panela
          </h1>
          <p className="hero__subtitle">
            Preparaciones sencillas y auténticas para bebidas, postres y salsas.
          </p>
          <nav className="hero__nav" aria-label="Secciones">
            <a href="#bebidas" className="hero__link">
              Bebidas
            </a>
            <a href="#postres" className="hero__link">
              Postres
            </a>
            <a href="#salsas" className="hero__link">
              Salsas
            </a>
          </nav>
        </header>

        {/* Bebidas */}
        <section id="bebidas" className="block">
          <h2 className="block__title">Bebidas</h2>
          <div className="grid">
            {bebidas.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        </section>

        {/* Postres */}
        <section id="postres" className="block">
          <h2 className="block__title">Postres</h2>
          <div className="grid">
            {postres.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        </section>

        {/* Salsas */}
        <section id="salsas" className="block">
          <h2 className="block__title">Salsas</h2>
          <div className="grid">
            {salsas.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
