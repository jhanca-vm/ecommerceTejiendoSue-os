// src/contexts/LoadingContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

const LoadingContext = createContext({ isLoading: false, pending: 0 });

export function LoadingProvider({
  children,
  slowThresholdMs = 12000, // watchdog por bucket
  showDelayMs = 450, // evita blink
}) {
  // Contadores separados
  const [httpPending, setHttpPending] = useState(0);
  const [routePending, setRoutePending] = useState(0);

  // Visibilidad derivada
  const anyPending = httpPending + routePending > 0;
  const [visible, setVisible] = useState(false);

  const timers = useRef({ show: null, hide: null });
  const httpWatchdog = useRef(null);
  const routeWatchdog = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ---------- Helpers ----------
  const clearShow = () => {
    if (timers.current.show) {
      clearTimeout(timers.current.show);
      timers.current.show = null;
    }
  };
  const clearHide = () => {
    if (timers.current.hide) {
      clearTimeout(timers.current.hide);
      timers.current.hide = null;
    }
  };
  const clearHttpWatch = () => {
    if (httpWatchdog.current) {
      clearTimeout(httpWatchdog.current);
      httpWatchdog.current = null;
    }
  };
  const clearRouteWatch = () => {
    if (routeWatchdog.current) {
      clearTimeout(routeWatchdog.current);
      routeWatchdog.current = null;
    }
  };

  const startHttpWatchdog = () => {
    clearHttpWatch();
    httpWatchdog.current = setTimeout(() => {
      // Opcional: lleva a una página de “lento” si hay HTTP pegado
      navigate("/status/slow", { replace: false });
      // Failsafe: suelta el bucket HTTP para no quedar pegado
      setHttpPending(0);
    }, slowThresholdMs);
  };

  const startRouteWatchdog = () => {
    clearRouteWatch();
    routeWatchdog.current = setTimeout(() => {
      // Si por alguna razón la ruta no volvió a idle, liberamos
      setRoutePending(0);
    }, slowThresholdMs);
  };

  // ---------- Eventos HTTP ----------
  useEffect(() => {
    const onHttpStart = () => {
      setHttpPending((p) => p + 1);
      // Programa el show con delay si no está visible
      if (!timers.current.show && !visible) {
        timers.current.show = setTimeout(() => {
          setVisible(true);
          timers.current.show = null;
        }, showDelayMs);
      }
      startHttpWatchdog();
    };

    const onHttpStop = () => {
      setHttpPending((p) => Math.max(0, p - 1));
      if (httpPending - 1 <= 0) {
        clearHttpWatch();
      }
    };

    window.addEventListener("http:start", onHttpStart);
    window.addEventListener("http:stop", onHttpStop);

    // Flush global opcional
    const onFlush = () => {
      setHttpPending(0);
      setRoutePending(0);
      setVisible(false);
      clearShow();
      clearHide();
      clearHttpWatch();
      clearRouteWatch();
    };
    window.addEventListener("http:flush", onFlush);

    return () => {
      window.removeEventListener("http:start", onHttpStart);
      window.removeEventListener("http:stop", onHttpStop);
      window.removeEventListener("http:flush", onFlush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, showDelayMs, slowThresholdMs]);

  // ---------- Eventos de RUTA ----------
  useEffect(() => {
    const onRouteStart = () => {
      setRoutePending((p) => p + 1);
      if (!timers.current.show && !visible) {
        timers.current.show = setTimeout(() => {
          setVisible(true);
          timers.current.show = null;
        }, showDelayMs);
      }
      startRouteWatchdog();
    };

    const onRouteStop = () => {
      setRoutePending((p) => Math.max(0, p - 1));
      if (routePending - 1 <= 0) {
        clearRouteWatch();
      }
    };

    window.addEventListener("route:start", onRouteStart);
    window.addEventListener("route:stop", onRouteStop);

    return () => {
      window.removeEventListener("route:start", onRouteStart);
      window.removeEventListener("route:stop", onRouteStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, showDelayMs, slowThresholdMs]);

  // ---------- Derivar visibilidad ----------
  useEffect(() => {
    if (anyPending) {
      // ya habrá un show programado o visible
      return;
    }
    // Si no hay pendientes, cerramos (cancelando cualquier show diferido)
    clearShow();
    if (!timers.current.hide && visible) {
      timers.current.hide = setTimeout(() => {
        setVisible(false);
        clearHide();
      }, 120); // salida corta
    }
  }, [anyPending, visible]);

  // ---------- Cambio de ruta física: reseteo defensivo ----------
  useEffect(() => {
    // Cuando realmente cambia el pathname, abortamos cualquier residuo
    setRoutePending(0);
    // Nota: NO tocamos httpPending; si hay una petición viva, debe decidir con http:stop
    clearShow();
    // No forzamos ocultar si hay HTTP vivo; lo gobierna el bucket HTTP
  }, [location.pathname]);

  const value = useMemo(
    () => ({
      isLoading: visible,
      pending: httpPending + routePending,
    }),
    [visible, httpPending, routePending]
  );

  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoading() {
  return useContext(LoadingContext);
}
