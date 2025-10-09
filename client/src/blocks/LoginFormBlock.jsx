// src/blocks/LoginFormBlock.jsx
import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiUrl from "../api/apiClient";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const LoginForm = () => {
  const { login } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
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

    try {
      setLoading(true);
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
    <div className="auth-shell">
      <section className="auth-card">
        <aside className="auth-hero auth-hero__login" aria-hidden="true">
          <div className="auth-hero__badge">Artesanías & Sabor</div>
          <h1 className="auth-hero__title">Tejiendo Sueños</h1>
          <p className="auth-hero__subtitle">
            Panela, café y paja toquilla: tradición que inspira cada compra.
          </p>
        </aside>

        <main className="auth-panel" role="main">
          <header className="auth-header">
            <h2 className="auth-title">Iniciar sesión</h2>
            <p className="auth-subtitle u-text-muted">
              Bienvenido de vuelta. ¡Qué bueno verte por aquí!
            </p>
          </header>

          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <div className="form-field">
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email"
                className="input"
                type="email"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="input-group">
                <input
                  id="login-password"
                  className="input"
                  type={showPwd ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-eye"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={
                    showPwd ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            <div className="auth-links">
              <Link to="/forgot-password" className="link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          <footer className="auth-footer">
            <span className="u-text-muted">¿No tienes cuenta?</span>{" "}
            <Link to="/register" className="link link--accent">
              Regístrate
            </Link>
          </footer>
        </main>
      </section>
    </div>
  );
};

export default LoginForm;
