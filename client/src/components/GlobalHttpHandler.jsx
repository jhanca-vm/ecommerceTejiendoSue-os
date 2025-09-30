import { useEffect, useRef } from "react";
import axios from "axios";
import api from "../api/apiClient"; 
import { useToast } from "../contexts/ToastContext";

/**
 * Monta interceptores globales de axios una sola vez.
 * Evita setState en cada render y previene bucles.
 */
export default function GlobalHttpHandler() {
  const { showToast } = useToast();
  const mountedRef = useRef(false);
  const installingRef = useRef(false);
  const interceptorsRef = useRef({ req: null, res: null });
  const lastErrorKeyRef = useRef("");

  useEffect(() => {
    if (mountedRef.current || installingRef.current) return;
    installingRef.current = true;

    // Request interceptor (opcional)
    const req = api.interceptors.request.use(
      (cfg) => cfg,
      (err) => Promise.reject(err)
    );

    // Response interceptor
    const res = api.interceptors.response.use(
      (resp) => resp,
      (error) => {
        // Evita loops y repeticiones de toast idénticos
        if (!axios.isCancel(error)) {
          const status = error?.response?.status;
          // Mensaje “clave” para deduplicación
          const key = `${status}:${error?.config?.url || ""}`;
          if (key !== lastErrorKeyRef.current) {
            lastErrorKeyRef.current = key;
            if (status >= 500) {
              showToast({
                type: "error",
                message: "Error del servidor. Intenta nuevamente.",
              });
            } else if (status === 401) {
              // no spamear el toast en renovaciones automáticas
            } else if (status === 429) {
              showToast({
                type: "warning",
                message: "Demasiadas solicitudes. Espera un momento.",
              });
            }
            // Limpia la clave después de un breve tiempo
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
  }, []);

  return null;
}
