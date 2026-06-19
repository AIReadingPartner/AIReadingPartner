const Chunk = require('../models/Chunk');

// MongoDB Atlas $vectorSearch backend. Same interface as the memory store.
const createAtlasStore = () => ({
  async upsert(userId, url, chunks, vectors) {
    await Chunk.deleteMany({ userId, url }); // idempotent per (userId,url)
    await Chunk.insertMany(
      chunks.map((c, i) => ({ userId, url, index: c.index, content: c.content, embedding: vectors[i] }))
    );
  },

  async retrieve(userId, url, queryVector, k = 5) {
    const rows = await Chunk.aggregate([
      {
        $vectorSearch: {
          index: 'chunk_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(k * 20, 100),
          limit: k,
          filter: { userId, url },
        },
      },
      { $project: { _id: 0, index: 1, content: 1, score: { $meta: 'vectorSearchScore' } } },
    ]);
    // Atlas cosine vectorSearchScore is normalized to (1 + cos) / 2 in [0,1].
    // Convert back to raw cosine [-1,1] so `score` means the same thing as the
    // in-memory store and a single minScore floor is backend-agnostic.
    return rows.map((r) => ({ ...r, score: 2 * r.score - 1 }));
  },
});

module.exports = { createAtlasStore };
