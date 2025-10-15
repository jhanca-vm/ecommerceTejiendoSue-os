import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import apiUrl from "../api/apiClient";

/**
 * Reemplaza con las URLs reales.
 * Si la URL está vacía, se muestra el icono deshabilitado (no clickable).
 */
const SOCIAL_LINKS = {
  instagram: "", // ej: "https://instagram.com/tu_marca"
  facebook: "", // ej: "https://facebook.com/tu_marca"
  tiktok: "", // ej: "https://tiktok.com/@tu_marca"
  whatsapp: "https://wa.me/573203385899", 
};

const Footer = () => {
  const [visits, setVisits] = useState(0);

  useEffect(() => {
    const increaseVisitIfFirst = async () => {
      try {
        if (!sessionStorage.getItem("visited")) {
          await apiUrl.post(`visits/increment`);
          sessionStorage.setItem("visited", "true");
        }
        const res = await apiUrl.get(`visits`);
        setVisits(res.data.count || 0);
      } catch (err) {
        console.error("Error con contador de visitas:", err);
      }
    };
    increaseVisitIfFirst();
  }, []);

  const year = new Date().getFullYear();

  // helper para social icon (si no hay url => deshabilitado)
  const SocialIcon = ({ href, label, children }) => {
    const isEnabled = Boolean(href);
    const className = `sf__social ${isEnabled ? "" : "is-disabled"}`;
    if (!isEnabled) {
      return (
        <span
          className={className}
          aria-label={`${label} próximamente`}
          title={`${label} próximamente`}
        >
          {children}
        </span>
      );
    }
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
      >
        {children}
      </a>
    );
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="sf__container">
        <div className="sf__grid">
          {/* Columna 1: Marca */}
          <div className="sf__col">
            <h4 className="sf__title">Artesanías Paja Toquilla</h4>
            <p className="sf__text">
              Productos artesanales sandoneños de la más alta calidad,
              elaborados con técnicas tradicionales y materiales sostenibles.
            </p>
          </div>

          {/* Columna 2: Productos */}
          <div className="sf__col">
            <h5 className="sf__subtitle">Productos</h5>
            <ul className="sf__links">
              <li>
                <Link to="/categoria/sombreros">Sombreros</Link>
              </li>
              <li>
                <Link to="/categoria/carteras">Carteras</Link>
              </li>
              <li>
                <Link to="/categoria/canastas">Canastas</Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Información */}
          <div className="sf__col">
            <h5 className="sf__subtitle">Información</h5>
            <ul className="sf__links">
              {/* Deja estas rutas si ya existen, o cámbialas luego */}
              <li>
                <Link to="/nosotros">Sobre Nosotros</Link>
              </li>
              <li>
                <Link to="/envios">Envíos</Link>
              </li>
              <li>
                <Link to="/contacto">Contacto</Link>
              </li>
            </ul>
          </div>

          {/* Columna 4: Síguenos */}
          <div className="sf__col">
            <h5 className="sf__subtitle">Síguenos</h5>
            <div className="sf__socialRow">
              <SocialIcon
                type="instagram"
                href={SOCIAL_LINKS.instagram}
                label="Instagram"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 7zm0 2.2A2.8 2.8 0 1 1 9.2 12 2.8 2.8 0 0 1 12 9.2ZM18.5 6a1 1 0 1 0 1 1 1 1 0 0 0-1-1Z" />
                </svg>
              </SocialIcon>

              <SocialIcon
                type="facebook"
                href={SOCIAL_LINKS.facebook}
                label="Facebook"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 22v-8h2.6l.4-3H13V8.5c0-.9.3-1.5 1.7-1.5H16V4.3A21.3 21.3 0 0 0 13.9 4C11.6 4 10 5.5 10 8.2V11H7v3h3v8h3Z" />
                </svg>
              </SocialIcon>

              <SocialIcon
                type="tiktok"
                href={SOCIAL_LINKS.tiktok}
                label="TikTok"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 7.5a7 7 0 0 1-4-1.4V16a5.5 5.5 0 1 1-5.5-5.5c.2 0 .4 0 .6.03V13a2.5 2.5 0 1 0 2.5 2.5V2h3a4.99 4.99 0 0 0 3.4 3.7V7.5Z" />
                </svg>
              </SocialIcon>

              <SocialIcon
                type="whatsapp"
                href={SOCIAL_LINKS.whatsapp}
                label="WhatsApp"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 3.5A10 10 0 0 0 3.7 17.4L3 21l3.7-.7A10 10 0 1 0 20.5 3.5Zm-8.5 17a8 8 0 0 1-4.1-1.1l-.3-.2-2.4.5.5-2.3-.2-.3a8 8 0 1 1 6.5 3.4ZM8.8 7.9c.2-.4.5-.4.7-.4h.6c.2 0 .5 0 .6.5.2.4.7 1.4.7 1.5s.1.3 0 .4c-.1.2-.2.3-.4.5-.2.1-.3.3-.1.5.1.2.5.8 1.1 1.2.7.4 1.2.5 1.4.4.2-.1.3-.3.4-.4.2-.1.3-.1.5 0 .1 0 1.3.6 1.3.6.2.1.4.2.5.3.1.2.1.9-.2 1.4s-1.1 1-1.6 1.1c-.4.1-1 .1-1.7-.1-.9-.3-1.9-.9-2.6-1.6-.7-.7-1.4-1.8-1.6-2.7-.1-.7 0-1.3.2-1.7.1-.3.6-1 1.1-1.6Z" />
                </svg>
              </SocialIcon>
            </div>
          </div>
        </div>

        <hr className="sf__rule" />

        {/* Barra inferior */}
        <div className="sf__bottom">
          <div className="sf__visits" title="Visitas totales">
            <p className="sf__copy">
              © {year} Artesanías Paja Toquilla. Todos los derechos reservados.
            </p>
            <p className="sf__copy">
              Diseño y desarrollo.{" "}
              <Link
                to="https://portafolio-sigma-smoky.vercel.app/"
                target="_blank"
              >
                Armando Mora.
              </Link>
            </p>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5c5 0 9.27 3.11 11 7-1.73 3.89-6 7-11 7S2.73 15.89 1 12c1.73-3.89 6-7 11-7Zm0 2c-3.73 0-7.07 2.13-8.71 5 1.64 2.87 4.98 5 8.71 5s7.07-2.13 8.71-5C19.07 9.13 15.73 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" />
            </svg>
            <span>Visitas: {visits}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
