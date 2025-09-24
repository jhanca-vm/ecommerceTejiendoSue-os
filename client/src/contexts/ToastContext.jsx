import { createContext, useContext, useState, useRef, useEffect } from "react";
import Toast from "../blocks/ToastBlock";

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // showToast acepta string o un objeto con: { message, type, actions, duration }
  const showToast = (input, fallbackType = "success") => {
    const opts =
      typeof input === "string"
        ? { message: input, type: fallbackType }
        : input || {};
    const {
      message,
      type = "success",
      actions = [],
      duration = 5000,
    } = opts;
    if (!message) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, actions });

    // auto-cierre
    timerRef.current = setTimeout(() => setToast(null), duration);
  };

  const closeToast = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  };

  const pause = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const resume = (duration = 2500) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), duration);
  };

  useEffect(() => {
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, closeToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actions={toast.actions}
          onClose={closeToast}
          onPause={pause}
          onResume={() => resume(2500)}
        />
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
