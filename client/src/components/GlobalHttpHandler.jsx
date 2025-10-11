// src/components/GlobalHttpHandler.jsx
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import api from "../api/apiClient";
import { useToast } from "../contexts/ToastContext";

/**
 * Manejo global:
 *  - Interceptores axios (toasts de error, ya lo tenías)
 *  - Overlay en cambios de ruta (emite http:start/stop artificial)
 */
export default function GlobalHttpHandler({
  showOnRouteChange = true,
  routeMinMs = 300,
  routeMaxMs = 1200,
}) {
  const { showToast } = useToast();
  const location = useLocation();

  // refs para interceptores
  const mountedRef = useRef(false);
  const installingRef = useRef(false);
  const interceptorsRef = useRef({ req: null, res: null });
  const lastErrorKeyRef = useRef("");

  // refs para loader de ruta
  const lastRouteIdRef = useRef(null);
  const minTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const lastPathRef = useRef(location.pathname);

  // ---------- Interceptores axios (lo que ya tenías) ----------
  useEffect(() => {
    if (mountedRef.current || installingRef.current) return;
    installingRef.current = true;

    const req = api.interceptors.request.use(
      (cfg) => cfg,
      (err) => Promise.reject(err)
    );

    const res = api.interceptors.response.use(
      (resp) => resp,
      (error) => {
        if (!axios.isCancel(error)) {
          const status = error?.response?.status;
          const key = `${status}:${error?.config?.url || ""}`;

          if (key !== lastErrorKeyRef.current) {
            lastErrorKeyRef.current = key;

            if (status >= 500) {
              showToast({
                type: "error",
                message: "Error del servidor. Intenta nuevamente.",
              });
            } else if (status === 401) {
              // silencioso durante refresh
            } else if (status === 429) {
              showToast({
                type: "warning",
                message: "Demasiadas solicitudes. Espera un momento.",
              });
            }

            setTimeout(() => {
              if (lastErrorKeyRef.current === key) lastErrorKeyRef.current = "";
            }, 1500);
          }
        }
        return Promise.reject(error);
      }
    );

    interceptorsRef.current = { req, res };
    mountedRef.current = true;
    installingRef.current = false;

    return () => {
      const { req: reqId, res: resId } = interceptorsRef.current || {};
      if (reqId != null) api.interceptors.request.eject(reqId);
      if (resId != null) api.interceptors.response.eject(resId);
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Loader en cambios de ruta ----------
  useEffect(() => {
    if (!showOnRouteChange) return;

    const prev = lastPathRef.current;
    const next = location.pathname + location.search + location.hash;
    if (prev === next) return;
    lastPathRef.current = next;

    // inicia overlay “artificial” por cambio de ruta
    const id =
      (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
      `route_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // Evita doble start si quedó uno activo
    if (lastRouteIdRef.current) {
      window.dispatchEvent(
        new CustomEvent("http:stop", { detail: { id: lastRouteIdRef.current } })
      );
      lastRouteIdRef.current = null;
    }

    lastRouteIdRef.current = id;

    window.dispatchEvent(
      new CustomEvent("http:start", {
        detail: { id, url: `route:${next}`, startedAt: Date.now() },
      })
    );

    // Asegura al menos routeMinMs de visibilidad para evitar "blink"
    if (minTimerRef.current) clearTimeout(minTimerRef.current);
    minTimerRef.current = setTimeout(() => {
      // hacemos stop; si hay requests reales en progreso, el overlay seguirá por el pending del provider
      window.dispatchEvent(new CustomEvent("http:stop", { detail: { id } }));
      if (lastRouteIdRef.current === id) lastRouteIdRef.current = null;
    }, Math.max(0, routeMinMs));

    // “freno de mano” (por si nada más detiene el artificial)
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("http:stop", { detail: { id } }));
      if (lastRouteIdRef.current === id) lastRouteIdRef.current = null;
    }, Math.max(routeMinMs + 1, routeMaxMs));

    return () => {
      if (minTimerRef.current) clearTimeout(minTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, [location, showOnRouteChange, routeMinMs, routeMaxMs]);

  return null;
}
