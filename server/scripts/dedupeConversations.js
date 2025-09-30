// scripts/dedupeConversations.js (script temporal)
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const dupes = await Conversation.aggregate([
      { $group: { _id: "$user", ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    for (const d of dupes) {
      // Conserva la más reciente
      const docs = await Conversation.find({ _id: { $in: d.ids } })
        .sort({ updatedAt: -1 })
        .lean();
      const keep = docs[0]._id;
      const remove = docs.slice(1).map((x) => x._id);
      if (remove.length) {
        await Conversation.deleteMany({ _id: { $in: remove } });
        console.log(`User ${d._id}: keep ${keep}, removed ${remove.length}`);
      }
    }

    console.log("Deduplicación completa");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
