const { retrieveContext, getStore } = require('../index');
const { createMemoryStore } = require('../memoryStore');

test('getStore returns memory store by default', () => {
  const prev = process.env.RAG_STORE;
  delete process.env.RAG_STORE;
  const store = getStore();
  expect(typeof store.retrieve).toBe('function');
  expect(typeof store.upsert).toBe('function');
  process.env.RAG_STORE = prev;
});

test('retrieveContext formats numbered context + citations from top hits', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 3, content: 'cats purr' }, { index: 7, content: 'dogs bark' }],
    [[1, 0], [0, 1]]);
  const embed = async () => [[1, 0]]; // query embeds near 'cats purr'

  const { context, citations, hits } = await retrieveContext({
    store, embed, userId: 'u1', url: 'http://x', query: 'what do cats do', k: 1,
  });

  expect(citations).toEqual([3]);
  expect(context).toContain('[3] cats purr');
  expect(hits[0].score).toBeCloseTo(1, 6);
});

test('retrieveContext returns empty when nothing indexed', async () => {
  const store = createMemoryStore();
  const embed = async () => [[1, 0]];
  const { context, citations } = await retrieveContext({
    store, embed, userId: 'u1', url: 'http://none', query: 'q', k: 5,
  });
  expect(citations).toEqual([]);
  expect(context).toBe('');
});
