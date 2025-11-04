// src/components/GlobalHttpHandler.jsx
import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Bridge compatible con BrowserRouter:
 * - Emite "route:start" en cada cambio de location
 * - Emite "route:stop" tras el siguiente repintado (2x rAF) + routeMinMs
 * - routeMaxMs corta por si algo queda colgado
 */
export default function GlobalHttpHandler({
  showOnRouteChange = true,
  routeMinMs = 300, // mínimo visible (suaviza blink)
  routeMaxMs = 1400, // máximo por navegación (fallback)
}) {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType(); // "POP" | "PUSH" | "REPLACE"

  const routeIdRef = useRef(null);
  const minTimer = useRef(null);
  const maxTimer = useRef(null);
  const raf1 = useRef(null);
  const raf2 = useRef(null);

  useEffect(() => {
    if (!showOnRouteChange) return;

    // START en cada cambio de ubicación
    const id = `route:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    routeIdRef.current = id;

    window.dispatchEvent(
      new CustomEvent("route:start", {
        detail: { id, navType, to: `${pathname}${search}${hash}` },
      })
    );

    const startAt = Date.now();

    // Fallback de máximo por navegación
    if (routeMaxMs > 0) {
      maxTimer.current = setTimeout(() => {
        if (routeIdRef.current === id) {
          window.dispatchEvent(
            new CustomEvent("route:stop", { detail: { id, reason: "max" } })
          );
          routeIdRef.current = null;
        }
      }, routeMaxMs);
    }

    // STOP: después de montar la nueva vista (2x rAF) y respetar routeMinMs
    const stop = () => {
      const elapsed = Date.now() - startAt;
      const remain = Math.max(0, routeMinMs - elapsed);
      minTimer.current = setTimeout(() => {
        if (routeIdRef.current === id) {
          window.dispatchEvent(
            new CustomEvent("route:stop", { detail: { id, reason: "settled" } })
          );
          routeIdRef.current = null;
        }
      }, remain);
    };

    // Dos frames para dar tiempo a layout/paint de la nueva ruta
    raf1.current = requestAnimationFrame(() => {
      raf2.current = requestAnimationFrame(stop);
    });

    // Limpieza al cambiar de ruta de nuevo o desmontar
    return () => {
      if (minTimer.current) {
        clearTimeout(minTimer.current);
        minTimer.current = null;
      }
      if (maxTimer.current) {
        clearTimeout(maxTimer.current);
        maxTimer.current = null;
      }
      if (raf1.current) {
        cancelAnimationFrame(raf1.current);
        raf1.current = null;
      }
      if (raf2.current) {
        cancelAnimationFrame(raf2.current);
        raf2.current = null;
      }
    };
  }, [
    pathname,
    search,
    hash,
    navType,
    showOnRouteChange,
    routeMinMs,
    routeMaxMs,
  ]);

  return null;
}
