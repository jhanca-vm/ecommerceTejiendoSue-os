// middleware/validation.js
const { body, param, validationResult } = require("express-validator");

// Regla de caracteres permitidos (nombres simples con acentos, números y algunos símbolos comunes)
const NAME_REGEX = /^[a-zA-ZÀ-ÿ0-9\s._\-#&/()+]+$/u;

// Normalizador defensivo del nombre
function normalizeName(v) {
  if (typeof v !== "string") return "";
  // trim + colapsar espacios internos
  return v.trim().replace(/\s+/g, " ").slice(0, 60);
}

// Validador de :id como ObjectId
const objectIdParam = (field = "id") => [
  param(field).isMongoId().withMessage(`${field} inválido`),
];

// Validadores de “name”
const nameValidators = (field = "name") => [
  body(field)
    .exists({ checkFalsy: true })
    .withMessage("Nombre requerido")
    .bail()
    .isString()
    .withMessage("Nombre inválido")
    .bail()
    .customSanitizer(normalizeName)
    .isLength({ min: 1, max: 60 })
    .withMessage("Nombre: 1–60 caracteres")
    .bail()
    .matches(NAME_REGEX)
    .withMessage("Nombre contiene caracteres no permitidos"),
];

// Manejo estándar de errores de express-validator
function handleValidationErrors(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const first = result.array({ onlyFirstError: true })[0];
  return res.status(400).json({ error: first?.msg || "Datos inválidos" });
}

module.exports = {
  NAME_REGEX,
  normalizeName,
  objectIdParam,
  nameValidators,
  handleValidationErrors,
};
