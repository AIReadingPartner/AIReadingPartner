const { agent } = require('../../controllers/agent');
const { createMemoryStore } = require('../../rag/memoryStore');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('400 when userId/url missing', async () => {
  const res = mockRes();
  await agent({ body: { goal: 'x' }, app: { locals: {} } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('runs the agent end to end with injected chat + store', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 2, content: 'The river flooded the town.' }], [[1, 0]]);

  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'retrieve', args: { query: 'flood' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'A flood hit the town.' }),
  };

  const req = {
    body: { userId: 'u1', url: 'http://x', goal: 'understand the flood' },
    app: { locals: {
      ragStore: store,
      ragEmbed: async () => [[1, 0]],
      ragGenerate: async () => 'unused here',
      agentChat: chat,
    } },
  };
  const res = mockRes();
  await agent(req, res);

  const payload = res.json.mock.calls[0][0];
  expect(payload.answer).toBe('A flood hit the town.');
  expect(payload.citations).toEqual([2]);
  expect(payload.toolTrace[0].tool).toBe('retrieve');
});
