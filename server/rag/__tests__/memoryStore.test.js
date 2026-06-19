const { createMemoryStore } = require('../memoryStore');

test('upsert then retrieve returns top-k ranked by cosine, with index+score', async () => {
  const store = createMemoryStore();
  await store.upsert(
    'u1', 'http://x',
    [{ index: 0, content: 'apple' }, { index: 5, content: 'banana' }],
    [[1, 0], [0, 1]]
  );
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 1);

  expect(hits).toHaveLength(1);
  expect(hits[0].index).toBe(0);
  expect(hits[0].content).toBe('apple');
  expect(hits[0].score).toBeCloseTo(1, 6);
});

test('upsert replaces prior chunks for the same (userId,url)', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x', [{ index: 0, content: 'old' }], [[1, 0]]);
  await store.upsert('u1', 'http://x', [{ index: 0, content: 'new' }], [[1, 0]]);
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 5);

  expect(hits).toHaveLength(1);
  expect(hits[0].content).toBe('new');
});

test('retrieve isolates by userId and url', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x', [{ index: 0, content: 'mine' }], [[1, 0]]);
  await store.upsert('u2', 'http://x', [{ index: 0, content: 'theirs' }], [[1, 0]]);
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 5);

  expect(hits.map((h) => h.content)).toEqual(['mine']);
});
