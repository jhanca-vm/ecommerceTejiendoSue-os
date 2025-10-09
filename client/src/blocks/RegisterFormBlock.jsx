import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";

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
  // 8+ caracteres, al menos 1 número y 1 símbolo
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
      const res = await apiUrl.post("/users/register", { name, email, password });
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
    <div className="login-container ">
      <h2>Registro</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label>Nombre completo</label>
          <input
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          {errors.name && <p className="form-error">{errors.name}</p>}
        </div>

        <div className="form-field">
          <label>Correo electrónico</label>
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {errors.email && <p className="form-error">{errors.email}</p>}
        </div>

        <div className="form-field">
          <label>Contraseña</label>
          <div className="input-group">
            <input
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
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPwd ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="form-hint">
            Mínimo 8 caracteres, 1 número y 1 símbolo.
          </p>
          {errors.password && <p className="form-error">{errors.password}</p>}
        </div>

        <div className="form-field">
          <label>Confirmar contraseña</label>
          <div className="input-group">
            <input
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

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? "Creando cuenta..." : "Registrarse"}
        </button>
      </form>

      <p className="auth-links">
        ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
      </p>
    </div>
  );
};

export default RegisterForm;
