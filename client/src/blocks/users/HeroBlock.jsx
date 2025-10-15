// src/blocks/users/HeroBlock.jsx
import React from "react";

import img from "../../assets/hat.png";

const HeroBlock = ({
  title = "Artesanía Sandoneña",
  highlight = "Auténtica",
  subtitle = `Descubre nuestra colección exclusiva de productos hechos a mano con paja toquilla, una tradición ancestral sandoneña que combina elegancia y calidad excepcional.`,
  ctaPrimaryText = "Explorar Productos",
  ctaSecondaryText = "Nuestra Historia",
  onPrimaryClick = () => {},
  onSecondaryClick = () => {},
  imageSrc = img ,
  imageAlt = "Artesana tejiendo sombrero de paja toquilla",
}) => {
  return (
    <section
      className="hero"
      role="banner"
      aria-label="Hero artesanías paja toquilla"
    >
      <span className="hero__bg-dot hero__bg-dot--1" aria-hidden="true"></span>
      <span className="hero__bg-dot hero__bg-dot--2" aria-hidden="true"></span>

      <div className="hero__container">
        <div className="hero__left">
          <h1 className="hero__title">
            <span className="hero__title-main">{title}</span>
            <br />
            <span className="hero__title-accent">{highlight}</span>
          </h1>

          <p className="hero__subtitle">{subtitle}</p>

          <div className="hero__actions">
            <button
              className="btn btn--primary"
              type="button"
              onClick={onPrimaryClick}
              aria-label="Explorar productos"
            >
              {ctaPrimaryText}
            </button>

            <button
              className="btn btn--ghost"
              type="button"
              onClick={onSecondaryClick}
              aria-label="Conocer nuestra historia"
            >
              {ctaSecondaryText}
            </button>
          </div>
        </div>

        <div className="hero__right">
          <figure className="hero__figure">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="hero__image"
              loading="eager"
              decoding="async"
            />
          </figure>
        </div>
      </div>
    </section>
  );
};

export default HeroBlock;
