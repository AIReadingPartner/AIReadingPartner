const { createEmbedder } = require('../embeddings');

test('embeds a batch of texts into vectors', async () => {
  const fakeModel = {
    batchEmbedContents: jest.fn().mockResolvedValue({
      embeddings: [{ values: [1, 2, 3] }, { values: [4, 5, 6] }],
    }),
  };
  const embed = createEmbedder(fakeModel);
  const vectors = await embed(['a', 'b']);

  expect(vectors).toEqual([[1, 2, 3], [4, 5, 6]]);
  expect(fakeModel.batchEmbedContents).toHaveBeenCalledWith({
    requests: [
      { content: { parts: [{ text: 'a' }] } },
      { content: { parts: [{ text: 'b' }] } },
    ],
  });
});

test('returns [] for empty input without calling the model', async () => {
  const fakeModel = { batchEmbedContents: jest.fn() };
  const embed = createEmbedder(fakeModel);
  expect(await embed([])).toEqual([]);
  expect(fakeModel.batchEmbedContents).not.toHaveBeenCalled();
});
