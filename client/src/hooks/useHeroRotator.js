// src/hooks/useHeroRotator.js
import { useEffect, useMemo, useRef, useState } from "react";

/** Baraja estilo Fisher–Yates */
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pre-carga segura de imágenes */
function preloadImages(items) {
  items.forEach((it) => {
    if (it?.imageSrc) {
      const img = new Image();
      img.src = it.imageSrc;
      // no asignamos handlers; la precarga es "best effort"
    }
  });
}

export default function useHeroRotator({
  items = [],
  intervalMs = 10000, // 10s: buen equilibrio lectura/accesibilidad
  persistSession = true, // recordar el orden en sessionStorage
}) {
  const storageKey = "heroRotatorOrder:v1";
  const [order, setOrder] = useState(() => {
    if (persistSession && typeof sessionStorage !== "undefined") {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === items.length) {
            return parsed;
          }
        } catch (_) {}
      }
    }
    const shuffled = shuffle(items.map((_, idx) => idx));
    if (persistSession && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(storageKey, JSON.stringify(shuffled));
    }
    return shuffled;
  });

  // Si cambia la cantidad de items, rebarajar para evitar out-of-range
  useEffect(() => {
    if (!items.length) return;
    if (order.length !== items.length) {
      const shuffled = shuffle(items.map((_, i) => i));
      setOrder(shuffled);
      if (persistSession && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(storageKey, JSON.stringify(shuffled));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  // Pre-carga una sola vez
  useEffect(() => {
    if (items.length) preloadImages(items);
  }, [items]);

  // Avance automático
  useEffect(() => {
    if (paused || items.length <= 1) return;
    timerRef.current && clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIdx((i) => (i + 1) % order.length);
    }, intervalMs);
    return () => clearTimeout(timerRef.current);
  }, [paused, idx, order.length, intervalMs, items.length]);

  // Pausar cuando la pestaña no está visible (ahorra recursos/“saltos”)
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden ? true : false);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const current = useMemo(() => items[order[idx]] ?? null, [items, order, idx]);

  const api = useMemo(
    () => ({
      isPaused: paused,
      pause: () => setPaused(true),
      resume: () => setPaused(false),
      next: () => setIdx((i) => (i + 1) % order.length),
      prev: () => setIdx((i) => (i - 1 + order.length) % order.length),
      position: idx,
      total: order.length,
    }),
    [idx, order.length, paused]
  );

  return { current, api };
}
