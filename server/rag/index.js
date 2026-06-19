const { createMemoryStore } = require('./memoryStore');
const { createAtlasStore } = require('./atlasStore');
const { embed } = require('./embeddings');

let _memo = null;
// Memory store is a singleton so ingest + query within a process share state.
const getStore = () => {
  if (process.env.RAG_STORE === 'atlas') return createAtlasStore();
  if (!_memo) _memo = createMemoryStore();
  return _memo;
};

// Embed the query, retrieve top-k, and format grounded context + citation indices.
const retrieveContext = async ({ store, embed: embedFn = embed, userId, url, query, k = 5 }) => {
  const [queryVector] = await embedFn([query]);
  const hits = await store.retrieve(userId, url, queryVector, k);
  const context = hits.map((h) => `[${h.index}] ${h.content}`).join('\n');
  const citations = hits.map((h) => h.index);
  return { context, citations, hits };
};

module.exports = { getStore, retrieveContext };
