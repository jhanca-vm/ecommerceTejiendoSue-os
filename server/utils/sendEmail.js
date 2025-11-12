// utils/sendEmail.js

const nodemailer = require("nodemailer");
const validator = require("validator");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, NODE_ENV } =
  process.env;

function ensureEnv() {
  const missing = [];
  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!SMTP_PORT) missing.push("SMTP_PORT");
  if (!SMTP_USER) missing.push("SMTP_USER");
  if (!SMTP_PASS) missing.push("SMTP_PASS");
  if (!FROM_EMAIL) missing.push("FROM_EMAIL");
  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno: ${missing.join(
        ", "
      )} (requeridas para email)`
    );
  }
  if (!validator.isEmail(FROM_EMAIL)) {
    throw new Error("FROM_EMAIL no es un correo válido.");
  }
}

ensureEnv();

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false, 
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  // Pool para evitar handshakes por cada correo
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  // Timeouts robustos
  socketTimeout: 20_000,
  greetingTimeout: 10_000,
  connectionTimeout: 10_000,
  // Evitar certificados rotos en dev corporativos (NO habilitar en prod)
  tls: NODE_ENV === "production" ? {} : { rejectUnauthorized: false },
});

// Utilidad sencilla para convertir HTML en texto plano legible (fallback)
function htmlToText(html = "") {
  try {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|br|h\d|li)>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function normalizeRecipients(to) {
  if (!to) return [];
  if (Array.isArray(to)) return to.filter(Boolean).map(String);
  return String(to)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateRecipients(toList) {
  if (!toList.length) {
    throw new Error("Destinatario vacío.");
  }
  for (const addr of toList) {
    if (!validator.isEmail(addr)) {
      throw new Error(`Destinatario inválido: ${addr}`);
    }
  }
}

// Envío con reintentos exponenciales: 3 intentos (0ms, 800ms, 1600ms)
async function sendWithRetries(mailOptions, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (err) {
      lastErr = err;
      // Errores transitorios típicos de red/SMTP → reintentar
      const transient =
        (err && err.code && /ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(err.code)) ||
        (err &&
          err.responseCode &&
          [421, 450, 451, 452].includes(err.responseCode));
      if (!transient || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, 800 * attempt || 1));
    }
  }
  throw lastErr;
}

async function sendEmail({ to, subject, html, from }) {
  const toList = normalizeRecipients(to);
  validateRecipients(toList);

  const fromAddress = (from || FROM_EMAIL).trim();

  const mailOptions = {
    from: fromAddress, 
    to: toList, 
    subject: subject || "(sin asunto)",
    html: html || "",
    text: htmlToText(html) || undefined,
  };

  const info = await sendWithRetries(mailOptions);
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `📧 Email enviado → ${toList.join(", ")} | messageId=${info.messageId}`
    );
  }
  return { messageId: info.messageId };
}

// API pública (mantiene tu interfaz actual)
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.CLIENT_URL}/verify-email/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6;">
      <h3>Bienvenido a Tejiendo Sueños</h3>
      <p>Para activar tu cuenta, haz clic en:</p>
      <p><a href="${link}" target="_blank" style="color:#3b82f6; text-decoration:none; font-weight:bold;">Verificar correo</a></p>
      <p>Si no creaste esta cuenta, ignora este correo.</p>
    </div>
  `;
  return sendEmail({
    to,
    subject: "Verifica tu cuenta - Tejiendo Sueños",
    html,
  });
};

exports.sendResetEmail = async (to, token) => {
  const link = `${process.env.CLIENT_URL}/reset-password/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6;">
      <h3>¿Olvidaste tu contraseña?</h3>
      <p>Haz clic para establecer una nueva:</p>
      <p><a href="${link}" target="_blank" style="color:#3b82f6; text-decoration:none; font-weight:bold;">Restablecer contraseña</a></p>
      <p>Este enlace expirará en 15 minutos.</p>
    </div>
  `;
  return sendEmail({
    to,
    subject: "Restablecer contraseña - Tejiendo Sueños",
    html,
  });
};

// (Opcional) exporta también sendEmail genérico si lo necesitas en otros flujos.
exports.sendEmail = sendEmail;
