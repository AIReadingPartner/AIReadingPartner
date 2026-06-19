const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  url: { type: String, required: true },
  index: { type: Number, required: true },   // source DOM block index (citation anchor)
  content: { type: String, required: true },
  embedding: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now },
});

chunkSchema.index({ userId: 1, url: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
