require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../models/Order");

const { MONGO_URI = "mongodb://localhost:27017/pajatoquilla" } = process.env;

(async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Mongo conectado. Iniciando backfill...");

  const cursor = Order.find({}).cursor();
  let n = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    let changed = false;

    if (!doc.statusTimestamps) {
      doc.statusTimestamps = {};
      changed = true;
    }

    // Inicial mínimo: 'pendiente' en createdAt si no está
    if (!doc.statusTimestamps.pendiente) {
      doc.statusTimestamps.pendiente = doc.createdAt || new Date();
      changed = true;
    }

    // currentStatusAt si falta: mejor estimación = updatedAt || createdAt
    if (!doc.currentStatusAt) {
      doc.currentStatusAt = doc.updatedAt || doc.createdAt || new Date();
      changed = true;
    }

    // statusHistory básico si vacío
    if (!Array.isArray(doc.statusHistory) || doc.statusHistory.length === 0) {
      doc.statusHistory = [
        { from: null, to: "pendiente", at: doc.statusTimestamps.pendiente, by: null },
      ];
      // si el estado actual no es pendiente, añadimos un salto aproximado en updatedAt
      if (doc.status && doc.status !== "pendiente") {
        doc.statusHistory.push({
          from: "pendiente",
          to: doc.status,
          at: doc.currentStatusAt,
          by: null,
        });
      }
      changed = true;
    }

    if (changed) {
      await doc.save();
      n++;
    }
  }

  console.log(`Backfill completado. Documentos actualizados: ${n}`);
  await mongoose.disconnect();
  process.exit(0);
})();
