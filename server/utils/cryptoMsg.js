// utils/cryptoMsg.js
const crypto = require("crypto");

function getKey() {
  const b64 = process.env.MSG_ENC_KEY || "";
  try {
    const key = Buffer.from(b64, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

function encryptText(plain) {
  const key = getKey();
  const text = String(plain || "");
  if (!key) {
    // Fallback: guarda como base64 marcado como 'plain'
    return { data: Buffer.from(text, "utf8").toString("base64"), iv: null, tag: null, alg: "plain" };
  }
  const iv = crypto.randomBytes(12); // GCM IV recomendado: 12 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    alg: "aes-256-gcm",
  };
}

function decryptText(encObj) {
  if (!encObj) return "";
  // Compatibilidad: si llega como 'plain' o sin iv/tag, intenta base64->utf8
  if (encObj.alg === "plain" || !(encObj.iv && encObj.tag)) {
    try { return Buffer.from(encObj.data || "", "base64").toString("utf8"); } catch { return String(encObj.data || ""); }
  }
  const key = getKey();
  if (!key) return ""; // sin clave válida, no podemos descifrar
  const iv = Buffer.from(encObj.iv, "base64");
  const tag = Buffer.from(encObj.tag, "base64");
  const data = Buffer.from(encObj.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

module.exports = { encryptText, decryptText };
