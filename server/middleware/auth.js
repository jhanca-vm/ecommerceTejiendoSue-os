const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const ALG = process.env.JWT_ALG || "HS256";
const ISS = process.env.JWT_ISS || undefined;
const AUD = process.env.JWT_AUD || undefined;
const CLOCK_TOL = Number(process.env.JWT_CLOCK_TOLERANCE_SEC || 0);

function verifyJwt(token, secret) {
  const opts = {
    algorithms: [ALG],
    clockTolerance: CLOCK_TOL > 0 ? CLOCK_TOL : undefined,
    issuer: ISS,
    audience: AUD,
  };
  return jwt.verify(token, secret, opts);
}

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token requerido" });
  try {
    const dec = verifyJwt(token, process.env.JWT_SECRET);
    req.user = {
      id: dec.id || dec._id || dec.sub,
      role: dec.role,
      isVerified: dec.isVerified === true,
    };
    if (!req.user.id) throw new Error("Token sin id de usuario");
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
  return res
    .status(403)
    .json({ error: "Verifica tu cuenta para realizar esta acción" });
};

module.exports = {
  verifyToken,
  isAdmin,
  onlyUsers,
  loginLimiter,
  requireVerified,
};
