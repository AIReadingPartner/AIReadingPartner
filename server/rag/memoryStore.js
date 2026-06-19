const { cosine } = require('./cosine');

const key = (userId, url) => `${userId}::${url}`;

// In-memory cosine store. Records: { index, content, vector }.
const createMemoryStore = () => {
  const tables = new Map();

  return {
    async upsert(userId, url, chunks, vectors) {
      tables.set(
        key(userId, url),
        chunks.map((c, i) => ({ index: c.index, content: c.content, vector: vectors[i] }))
      );
    },

    async retrieve(userId, url, queryVector, k = 5) {
      const rows = tables.get(key(userId, url)) || [];
      return rows
        .map((r) => ({ index: r.index, content: r.content, score: cosine(queryVector, r.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },
  };
};

module.exports = { createMemoryStore };
