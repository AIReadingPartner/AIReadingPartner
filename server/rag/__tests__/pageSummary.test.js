const { pageSummarize } = require('../../controllers/pageSummary');
const { createMemoryStore } = require('../memoryStore');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('summarizes retrieved context and returns citations', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 2, content: 'The river flooded the town.' }], [[1, 0]]);

  const req = {
    body: { userId: 'u1', type: 'summary', browsingTarget: 'flood', currentWebpage: 'http://x' },
    app: { locals: {
      ragStore: store,
      ragEmbed: async () => [[1, 0]],
      ragGenerate: async (prompt) => 'A flood hit the town.',
      ragSkipPersist: true,
    } },
  };
  const res = mockRes();
  await pageSummarize(req, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    citations: [2],
  }));
  const payload = res.json.mock.calls[0][0];
  expect(payload.data.result).toBe('A flood hit the town.');
});

test('returns not-indexed message when no chunks for the page', async () => {
  const store = createMemoryStore();
  const req = {
    body: { userId: 'u1', type: 'summary', browsingTarget: 'flood', currentWebpage: 'http://none' },
    app: { locals: { ragStore: store, ragEmbed: async () => [[1, 0]], ragGenerate: async () => 'x', ragSkipPersist: true } },
  };
  const res = mockRes();
  await pageSummarize(req, res);

  const payload = res.json.mock.calls[0][0];
  expect(payload.citations).toEqual([]);
  expect(payload.message).toMatch(/not indexed/i);
});
