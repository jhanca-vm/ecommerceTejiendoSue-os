// src/blocks/users/RotatingHero.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useHeroRotator from "../../../hooks/useHeroRotator";
import heroVariants from "./heroariants";
import HeroBlock from "../HeroBlock";

const RotatingHero = ({
  intervalMs = 10000,
  enableControls = false, // si quieres flechas manuales
}) => {
  const navigate = useNavigate();
  const { current, api } = useHeroRotator({
    items: heroVariants,
    intervalMs,
  });

  // Para un fade suave cuando cambia “current”
  const [fadeKey, setFadeKey] = useState(0);
  useEffect(() => setFadeKey((k) => k + 1), [current?.key]);

  if (!current) return null;

  return (
    <div
      className="rotating-hero"
      onMouseEnter={api.pause}
      onMouseLeave={api.resume}
      aria-roledescription="carrusel promocional"
    >
      <div key={fadeKey} className="rotating-hero__inner">
        <HeroBlock
          title={current.title}
          highlight={current.highlight}
          subtitle={current.subtitle}
          ctaPrimaryText={current.ctaPrimaryText}
          ctaSecondaryText={current.ctaSecondaryText}
          onPrimaryClick={() => navigate(current.ctaRoutePrimary || "/tienda")}
          onSecondaryClick={() =>
            navigate(current.ctaRouteSecondary || "/nosotros")
          }
          imageSrc={current.imageSrc}
          imageAlt={current.imageAlt}
        />
      </div>

      {enableControls && (
        <div className="rotating-hero__controls" aria-hidden="true">
          <button
            type="button"
            className="rh-btn"
            onClick={api.prev}
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="rh-btn"
            onClick={api.next}
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};

export default RotatingHero;
