const cron = require("node-cron");
const { checkStaleOrders } = require("../utils/orderStaleAlerts");

/**
 * Inicializa cron-jobs.
 * @param {import("express").Express} app
 */
module.exports = function initScheduler(app) {
  const io = app.get("io");

  // Corre cada hora al minuto 0
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("[scheduler] checkStaleOrders start");
      await checkStaleOrders({ io });
      console.log("[scheduler] checkStaleOrders done");
    } catch (e) {
      console.error("[scheduler] checkStaleOrders error:", e?.message || e);
    }
  });

  console.log("⏰ Cronjobs inicializados (ordenes estancadas cada hora).");
};
