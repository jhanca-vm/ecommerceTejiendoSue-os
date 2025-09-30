// routes/userRoutes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

const userController = require("../controllers/userController");
const { verifyToken, isAdmin, loginLimiter } = require("../middleware/auth");
const { uploadAvatar, processAvatar } = require("../middleware/iploadAvatar");

const router = express.Router();

/* ---------------------- LIMITERS ESPECÍFICOS ---------------------- */

// Login: slowdown corto + tu loginLimiter (defensa bruteforce)
const loginSlowdown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 3,
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 250;
  },
  maxDelayMs: 2000,
});

// Refresh token: permisivo para no romper UX al recargar
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Acciones de email (resend/forgot): proteger abuso
const emailActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ---------------------- RUTAS PÚBLICAS ---------------------- */
router.post("/register", userController.register);

// Login con slowdown + loginLimiter del middleware/auth
router.post("/login", loginSlowdown, loginLimiter, userController.login);

router.post("/logout", userController.logout);

// Refresh con limit alto (no 429 por recargas)
router.get("/refresh-token", refreshLimiter, userController.refreshToken);

router.get("/verify/:token", userController.verifyEmail);

router.post(
  "/resend-verification",
  emailActionLimiter,
  userController.resendVerification
);
router.post(
  "/forgot-password",
  emailActionLimiter,
  userController.forgotPassword
);
router.post("/reset-password/:token", userController.resetPassword);

/* ---------------------- PERFIL (AUTH) ---------------------- */
router.get("/me", verifyToken, userController.getMe);
router.patch("/me", verifyToken, userController.updateMe);
router.patch("/me/password", verifyToken, userController.changePassword);
router.patch(
  "/me/avatar",
  verifyToken,
  uploadAvatar,
  processAvatar,
  userController.updateAvatar
);

/* ---------------------- OTRAS PROTEGIDAS ---------------------- */
router.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "Perfil de usuario", user: req.user });
});
router.get("/admin-dashboard", verifyToken, isAdmin, (req, res) => {
  res.json({ message: "Bienvenido al panel de administrador" });
});

module.exports = router;
