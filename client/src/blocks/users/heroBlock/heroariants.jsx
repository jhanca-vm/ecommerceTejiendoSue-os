// src/blocks/users/heroVariants.js
import hatImg from "../../../assets/hat.png";
import coffeeImg from "../../../assets/manos.png";
import panelaImg from "../../../assets/sandona.png";
import comboImg from "../../../assets/login.png";

const heroVariants = [
  {
    key: "artesania",
    title: "Artesanía Sandoneña",
    highlight: "Auténtica",
    subtitle:
      "Descubre piezas únicas en paja toquilla, tejidas a mano por artesanos de Sandoná. Tradición, elegancia y calidad excepcional.",
    ctaPrimaryText: "Explorar Artesanías",
    ctaSecondaryText: "Nuestra Historia",
    ctaRoutePrimary: "/artesanias",
    ctaRouteSecondary: "/nosotros",
    imageSrc: hatImg,
    imageAlt: "Manos tejiendo sombrero de paja toquilla",
  },
  {
    key: "cafe",
    title: "Café de Nariño",
    highlight: "Origen de Altura",
    subtitle:
      "Granos seleccionados de cosecha responsable, tueste fresco y notas aromáticas que celebran la cordillera.",
    ctaPrimaryText: "Comprar Café",
    ctaSecondaryText: "Métodos de Preparación",
    ctaRoutePrimary: "/cafe",
    ctaRouteSecondary: "/guias/cafe",
    imageSrc: coffeeImg,
    imageAlt: "Granos de café y vertido en método pour-over",
  },
  {
    key: "panela",
    title: "Panela Artesanal",
    highlight: "Pura y Natural",
    subtitle:
      "Dulzor auténtico elaborado de caña recién molida. Ideal para bebidas y cocina saludable, sin refinados.",
    ctaPrimaryText: "Ver Presentaciones",
    ctaSecondaryText: "Recetas con Panela",
    ctaRoutePrimary: "/panela",
    ctaRouteSecondary: "/recetas/panela",
    imageSrc: panelaImg,
    imageAlt: "Bloques de panela y caña de azúcar",
  },
  {
    key: "packs",
    title: "Sabores & Oficios",
    highlight: "Que Inspiran",
    subtitle:
      "Completa tu experiencia con sets de regalo y ediciones limitadas que combinan artesanía, café y panela.",
    ctaPrimaryText: "Explorar Todo",
    ctaSecondaryText: "Arma tu Pack",
    ctaRoutePrimary: "/productos",
    ctaRouteSecondary: "/packs",
    imageSrc: comboImg,
    imageAlt: "Caja de regalo con artesanías, café y panela",
  },
];

export default heroVariants;
