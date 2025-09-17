const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token requerido" });
  try {
    const dec = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: dec.id, role: dec.role, isVerified: dec.isVerified };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

const isAdmin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Acceso denegado: solo administradores" });

const onlyUsers = (req, res, next) =>
  req.user?.role === "user"
    ? next()
    : res
        .status(403)
        .json({ error: "Solo usuarios pueden gestionar favoritos" });

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos fallidos. Intenta nuevamente en unos minutos.",
  },
});

const requireVerified = (req, res, next) => {
  if (req.user?.isVerified === true) return next();
  return res.status(403).json({ error: "Verifica tu cuenta para realizar esta acción" });
};

module.exports = { verifyToken, isAdmin, onlyUsers, loginLimiter, requireVerified };
