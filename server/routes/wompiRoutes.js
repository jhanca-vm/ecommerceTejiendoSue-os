const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { signIntegrity } = require("../controllers/wompiController");

router.post("/integrity-signature", verifyToken, signIntegrity);

module.exports = router;
