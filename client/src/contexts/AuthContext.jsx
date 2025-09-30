// src/contexts/AuthContext.jsx
import { createContext, useEffect, useRef, useState } from "react";
import api from "../api/apiClient";
import {
  getToken,
  setToken as setTokenLS,
  removeToken as removeTokenLS,
} from "../utils/authHelpers";
import { setAccessToken, clearAccessToken } from "../api/tokenStore";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 1) Estado base desde almacenamiento (no bloquear la UI)
  const bootToken = getToken() || "";
  const bootUser = (() => {
    try {
      const s = localStorage.getItem("user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })();

  const [token, setTokenState] = useState(bootToken);
  const [user, setUser] = useState(bootUser);
  const [authReady, setAuthReady] = useState(false);

  // guard para que el bootstrap ocurra una vez
  const bootstrapped = useRef(false);

  // 2) Bootstrap de sesión:
  //    - Si ya hay token en LS: lo aplicamos y NO bloqueamos la app.
  //    - En paralelo (una sola vez), intentamos refresh con cookie httpOnly;
  //      si sale 200, actualizamos; si 401/403 lo ignoramos.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // aplica el token de arranque (si existe)
    if (bootToken) {
      setAccessToken(bootToken);
      setAuthReady(true); // no bloquees la UI si ya hay token
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/users/refresh-token", {
          withCredentials: true,
          __internal: true,
        });
        if (cancelled) return;

        // si el backend devuelve token/user, actualiza la sesión
        if (data?.token) {
          setAccessToken(data.token);
          setTokenLS?.(data.token);
          setTokenState(data.token);
        }
        if (data?.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          setUser(data.user);
        }
      } catch (e) {
        // 401/403 => cookie ausente o expirada. No es error de app.
        // Si no había token de arranque, quedamos como invitado.
      } finally {
        if (!bootToken) setAuthReady(true); // si no lo marcamos antes
      }
    })();

    return () => {
      cancelled = true; // evita setState tras unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) API pública del contexto
  const login = (newToken, userData) => {
    setAccessToken(newToken);
    setTokenLS?.(newToken);
    setTokenState(newToken);

    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);

    if (!authReady) setAuthReady(true);
  };

  const logout = async () => {
    try {
      await api.post("/users/logout");
    } catch {
      // ignorar: siempre limpiamos cliente
    }
    clearAccessToken();
    removeTokenLS?.();
    localStorage.removeItem("user");
    setTokenState("");
    setUser(null);
    // authReady sigue true para no bloquear la navegación
  };

  return (
    <AuthContext.Provider value={{ token, user, authReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
