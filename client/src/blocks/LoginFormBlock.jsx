import { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import apiUrl from "../api/apiClient";

import { useToast } from "../contexts/ToastContext";

const LoginForm = () => {
  const { login } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const newErrors = {};
    if (!emailRegex.test(email)) newErrors.email = "Correo inválido.";
    if (!password.trim()) newErrors.password = "La contraseña es requerida.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await apiUrl.post("/users/login", { email, password });
      login(res.data.token, res.data.user);

      showToast("Inicio de sesión exitoso", "success");
      res.data.user.role === "admin" ? navigate("/admin") : navigate("/");
    } catch (err) {
      let msg = "Error al iniciar sesión";

      if (err.response?.status === 429) {
        msg = "Demasiados intentos fallidos. Intenta de nuevo más tarde.";
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      }

      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ao">
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleLogin} >
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {errors.email && <p className="form-error">{errors.email}</p>}

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {errors.password && <p className="form-error">{errors.password}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p>
        ¿No tienes cuenta? <a href="/register">Regístrate</a>
      </p>
      <p>
        <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
      </p>
    </div>
  );
};

export default LoginForm;
