// src/blocks/RegisterFormBlock.jsx
import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiUrl from "../api/apiClient";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const RegisterForm = () => {
  const { login } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = "El nombre es obligatorio.";
    if (!emailRegex.test(email)) newErrors.email = "Correo inválido.";
    if (!passwordRegex.test(password)) {
      newErrors.password = "Mínimo 8 caracteres, 1 número y 1 símbolo.";
    }
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Confirma tu contraseña.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    try {
      setLoading(true);
      const res = await apiUrl.post("/users/register", {
        name,
        email,
        password,
      });
      login(res.data.token, res.data.user);
      showToast("Registro exitoso. Revisa tu correo.", "info");
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.error || "Error al registrar";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <aside className="auth-hero auth-hero--register" aria-hidden="true">
          <div className="auth-hero__badge">Registro</div>
          <h1 className="auth-hero__title">Únete a la comunidad</h1>
          <p className="auth-hero__subtitle">
            Compra directo a artesanos: panela, café y piezas en paja toquilla.
          </p>
        </aside>

        <main className="auth-panel" role="main">
          <header className="auth-header">
            <h2 className="auth-title">Crea tu cuenta</h2>
            <p className="auth-subtitle u-text-muted">
              En menos de un minuto estás listo para comprar.
            </p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="reg-name">Nombre completo</label>
              <input
                id="reg-name"
                className="input"
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="reg-email">Correo electrónico</label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password">Contraseña</label>
              <div className="input-group">
                <input
                  id="reg-password"
                  className="input"
                  type={showPwd ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
              <p className="form-hint">
                Mínimo 8 caracteres, 1 número y 1 símbolo.
              </p>
              {errors.password && (
                <p className="form-error">{errors.password}</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="reg-password2">Confirmar contraseña</label>
              <div className="input-group">
                <input
                  id="reg-password2"
                  className="input"
                  type={showPwd2 ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-eye"
                  onClick={() => setShowPwd2((s) => !s)}
                  aria-label={
                    showPwd2 ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPwd2 ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="form-error">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
            >
              {loading ? "Creando cuenta..." : "Registrarse"}
            </button>

            <div className="auth-links">
              <span className="u-text-muted">¿Ya tienes cuenta?</span>{" "}
              <Link to="/login" className="link link--accent">
                Inicia sesión
              </Link>
            </div>
          </form>
        </main>
      </section>
    </div>
  );
};

export default RegisterForm;

