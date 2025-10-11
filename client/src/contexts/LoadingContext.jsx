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
  slowThresholdMs = 15000,
  showDelayMs = 250,
}) {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef({ show: null });
  const watchdogs = useRef(new Map()); // id -> timeout
  const lastSlowEventRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Oculta loader inmediatamente y limpia el delay
  const hideLoader = () => {
    setPending((p) => Math.max(0, p - 1));
  };

  const onStart = (e) => {
    const { id, url, startedAt } = e.detail;
    setPending((p) => p + 1);

    // Delay para evitar "blink"
    if (!timers.current.show && pending === 0) {
      timers.current.show = setTimeout(() => {
        setVisible(true);
        timers.current.show = null;
      }, showDelayMs);
    }

    // Watchdog por request
    const to = setTimeout(() => {
      lastSlowEventRef.current = {
        id,
        url,
        startedAt,
        elapsed: Date.now() - startedAt,
      };
      // Redirigimos a /status/slow con estado
      navigate("/status/slow", {
        state: lastSlowEventRef.current,
        replace: false,
      });
    }, slowThresholdMs);
    watchdogs.current.set(id, to);
  };

  const onStop = (e) => {
    const { id } = e.detail;
    const to = watchdogs.current.get(id);
    if (to) {
      clearTimeout(to);
      watchdogs.current.delete(id);
    }
    hideLoader();
  };

  useEffect(() => {
    // si se navega, cancelar timers de mostrar loader
    return () => {
      if (timers.current.show) {
        clearTimeout(timers.current.show);
        timers.current.show = null;
      }
      // al desmontar, limpiar watchdogs
      for (const [, to] of watchdogs.current) clearTimeout(to);
      watchdogs.current.clear();
    };
  }, []);

  useEffect(() => {
    window.addEventListener("http:start", onStart);
    window.addEventListener("http:stop", onStop);
    return () => {
      window.removeEventListener("http:start", onStart);
      window.removeEventListener("http:stop", onStop);
    };
  }, [pending]);

  // Si ya no hay pendientes, ocultar overlay (y cancelar delay si estaba)
  useEffect(() => {
    if (pending <= 0) {
      if (timers.current.show) {
        clearTimeout(timers.current.show);
        timers.current.show = null;
      }
      setVisible(false);
    }
  }, [pending]);

  // Fail-safe: si pending > 0 por demasiado tiempo sin cambios, resetea
  useEffect(() => {
    let t = null;
    if (pending > 0) {
      t = setTimeout(() => {
        // corta el overlay si quedó pegado
        setPending(0);
        setVisible(false);
      }, 15000); // 15s; ajústalo si quieres
    }
    return () => t && clearTimeout(t);
  }, [pending]);

  // Opcional: si llega un "flush" (cancelAllActiveRequests), resetea de inmediato
  useEffect(() => {
    const onFlush = () => {
      setPending(0);
      setVisible(false);
    };
    window.addEventListener("http:flush", onFlush);
    return () => window.removeEventListener("http:flush", onFlush);
  }, []);

  // Si cambiamos de ruta, reseteamos loader
  useEffect(() => {
    setPending(0);
    setVisible(false);
  }, [location.pathname]);

  const value = useMemo(
    () => ({ isLoading: visible, pending }),
    [visible, pending]
  );
  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoading() {
  return useContext(LoadingContext);
}
