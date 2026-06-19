const { ingest } = require('../../controllers/ingest');
const { createMemoryStore } = require('../memoryStore');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('400 when blocks missing', async () => {
  const res = mockRes();
  await ingest({ body: { userId: 'u1', url: 'http://x' }, app: { locals: {} } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('chunks, embeds, upserts and returns chunkCount', async () => {
  const store = createMemoryStore();
  const embed = jest.fn(async (texts) => texts.map(() => [1, 0]));
  const req = {
    body: { userId: 'u1', url: 'http://x', blocks: [{ index: 0, content: 'hello world here' }] },
    app: { locals: { ragStore: store, ragEmbed: embed } },
  };
  const res = mockRes();
  await ingest(req, res);

  expect(embed).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ chunkCount: 1 }));
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 5);
  expect(hits[0].content).toContain('hello world here');
});
