// middleware/csrf.js
const crypto = require("crypto");

const CSRF_COOKIE = "csrfToken";

/**
 * Emite un token CSRF "doble submit cookie":
 * - set-cookie legible por JS (NO httpOnly) y
 * - lo devuelve en el body para que el front lo guarde.
 */
exports.issueCsrfToken = (req, res) => {
  const token = crypto.randomBytes(24).toString("hex");
  // Cookie legible por el cliente (no httpOnly) pero con SameSite y Secure si aplica
  const isProd = (process.env.NODE_ENV || "development") === "production";
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,            // debe ser legible por JS para doble submit
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 2 * 60 * 60 * 1000, // 2h
  });
  res.json({ csrfToken: token });
};

/**
 * Exige X-CSRF-Token SOLO en métodos que modifican estado.
 * Estrategia simple: GET/HEAD/OPTIONS -> permitido; el resto -> validar.
 * Validación flexible:
 *   - header presente Y (opcional) coincide con cookie si existe.
 */
exports.requireCsrf = (req, res, next) => {
  const method = (req.method || "GET").toUpperCase();
  const safe = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (safe) return next();

  const header = req.get("X-CSRF-Token");
  const cookie = req.cookies?.[CSRF_COOKIE];

  // 1) Debe venir header
  if (!header) {
    return res.status(403).json({ error: "CSRF token missing" });
  }

  // 2) Si existe cookie, deben coincidir (doble submit cookie)
  if (cookie && header !== cookie) {
    return res.status(403).json({ error: "CSRF token mismatch" });
  }

  return next();
};

