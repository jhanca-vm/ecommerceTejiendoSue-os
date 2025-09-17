require("dotenv").config();
const mongoose = require("mongoose");

const { MONGO_URI = "mongodb://localhost:27017/pajatoquilla" } = process.env;

async function run() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  // Si cambian los nombres de colecciones, ajusta aquí.
  const targets = [
    { coll: "colors", field: "name" },
    { coll: "sizes", field: "label" },
    { coll: "categories", field: "name" },
  ];

  for (const t of targets) {
    try {
      console.log(`-> Creando índice único case-insensitive en ${t.coll}.${t.field}`);
      await db.collection(t.coll).createIndex(
        { [t.field]: 1 },
        {
          unique: true,
          collation: { locale: "es", strength: 2 },
          name: `uniq_${t.field}_es_ci`,
        }
      );
      console.log(`OK: ${t.coll}`);
    } catch (e) {
      console.warn(`WARN en ${t.coll}:`, e.message);
    }
  }

  await mongoose.disconnect();
  console.log("Listo.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
