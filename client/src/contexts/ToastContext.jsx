import { createContext, useContext, useState, useRef, useEffect } from "react";

import Toast from "../blocks/ToastBlock";

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // showToast acepta string o un objeto con: { message, type, actions, duration, ariaLive }
  const showToast = (input, fallbackType = "success") => {
    const opts =
      typeof input === "string"
        ? { message: input, type: fallbackType }
        : input || {};
    const {
      message,
      type = "success",
      actions = [], // [{ label, onClick }]
      duration = 3000, // ms
      ariaLive = "polite", // "polite" | "assertive"
    } = opts;
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, actions, ariaLive });
    timerRef.current = setTimeout(() => setToast(null), duration);
  };

  const closeToast = () => setToast(null);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  return (
    <ToastContext.Provider value={{ showToast, closeToast }}>
      {children}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actions={toast.actions}
          ariaLive={toast.ariaLive}
          onClose={closeToast}
        />
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
