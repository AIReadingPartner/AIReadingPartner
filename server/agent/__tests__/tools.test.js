const { createTools } = require('../tools');
const { createMemoryStore } = require('../../rag/memoryStore');

const setup = () => {
  const store = createMemoryStore();
  const embed = async () => [[1, 0]];
  const generate = jest.fn(async () => 'GENERATED');
  return { store, embed, generate };
};

const seed = (store) =>
  store.upsert('u1', 'http://x',
    [{ index: 2, content: 'The river flooded the town.' }], [[1, 0]]);

test('declarations expose the four tool names', () => {
  const { declarations } = createTools({ userId: 'u1', url: 'http://x' });
  expect(declarations.map((d) => d.name).sort()).toEqual(
    ['explainSentence', 'highlightRelevant', 'retrieve', 'summarize']
  );
});

test('retrieve returns numbered context + citations', async () => {
  const { store, embed, generate } = setup();
  await seed(store);
  const { handlers } = createTools({ userId: 'u1', url: 'http://x', store, embed, generate });
  const out = await handlers.retrieve({ query: 'flood' });
  expect(out.citations).toEqual([2]);
  expect(out.context).toContain('[2] The river flooded the town.');
});

test('summarize generates over retrieved context and returns citations', async () => {
  const { store, embed, generate } = setup();
  await seed(store);
  const { handlers } = createTools({ userId: 'u1', url: 'http://x', store, embed, generate });
  const out = await handlers.summarize({ goal: 'flood' });
  expect(generate).toHaveBeenCalled();
  expect(out.result).toBe('GENERATED');
  expect(out.citations).toEqual([2]);
});

test('explainSentence on unindexed page returns no-content without calling generate', async () => {
  const { store, embed, generate } = setup();
  const { handlers } = createTools({ userId: 'u1', url: 'http://none', store, embed, generate });
  const out = await handlers.explainSentence({ sentence: 'x' });
  expect(generate).not.toHaveBeenCalled();
  expect(out.result).toMatch(/no relevant content/i);
  expect(out.citations).toEqual([]);
});

test('highlightRelevant returns chunk indices', async () => {
  const { store, embed, generate } = setup();
  await seed(store);
  const { handlers } = createTools({ userId: 'u1', url: 'http://x', store, embed, generate });
  const out = await handlers.highlightRelevant({ goal: 'flood' });
  expect(out.indices).toEqual([2]);
});
