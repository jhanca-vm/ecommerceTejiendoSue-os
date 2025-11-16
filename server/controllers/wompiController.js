const crypto = require("crypto");

exports.signIntegrity = async (req, res) => {
  const { reference, amount } = req.body;
  const encondedText = new TextEncoder().encode(
    `${reference}${amount}COP${process.env.INTEGRITY_SECRET}`,
  );

  const hashBuffer = await crypto.subtle.digest("SHA-256", encondedText);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  res.send(hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""));
};
