const { chunk } = require('../chunker');

test('drops empty/whitespace blocks', () => {
  const out = chunk([{ index: 0, content: '   ' }, { index: 1, content: 'hello world' }]);
  expect(out).toEqual([{ index: 1, content: 'hello world' }]);
});

test('merges small adjacent blocks under maxChars and keeps first index', () => {
  const out = chunk(
    [{ index: 0, content: 'aaa' }, { index: 1, content: 'bbb' }, { index: 2, content: 'ccc' }],
    { maxChars: 8 }
  );
  expect(out).toEqual([
    { index: 0, content: 'aaa\nbbb' },
    { index: 2, content: 'ccc' },
  ]);
});

test('a single oversized block is its own chunk', () => {
  const big = 'x'.repeat(50);
  const out = chunk([{ index: 0, content: big }], { maxChars: 10 });
  expect(out).toEqual([{ index: 0, content: big }]);
});
