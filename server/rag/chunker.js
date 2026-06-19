// Merge indexed DOM blocks into ~maxChars chunks, preserving the first
// block's index as the chunk's citation anchor.
const chunk = (blocks, { maxChars = 500 } = {}) => {
  const chunks = [];
  let current = null;

  for (const block of blocks) {
    const content = (block.content || '').trim();
    if (!content) continue;

    if (current && current.content.length + 1 + content.length <= maxChars) {
      current.content += '\n' + content;
    } else {
      current = { index: block.index, content };
      chunks.push(current);
    }
  }

  return chunks;
};

module.exports = { chunk };
