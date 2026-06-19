const { cosine } = require('../cosine');

test('identical vectors score 1', () => {
  expect(cosine([1, 0, 1], [1, 0, 1])).toBeCloseTo(1, 6);
});

test('orthogonal vectors score 0', () => {
  expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
});

test('zero vector scores 0 (no NaN)', () => {
  expect(cosine([0, 0], [1, 1])).toBe(0);
});
