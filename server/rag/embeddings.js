const { GoogleGenerativeAI } = require('@google/generative-ai');

const EMBED_MODEL = 'text-embedding-004';

// Build an embed(texts) fn from any model exposing batchEmbedContents.
const createEmbedder = (model) => async (texts) => {
  if (!texts || texts.length === 0) return [];
  const res = await model.batchEmbedContents({
    requests: texts.map((text) => ({ content: { parts: [{ text }] } })),
  });
  return res.embeddings.map((e) => e.values);
};

// Default embedder wired to Gemini, created lazily so tests never need a key.
let _defaultEmbed = null;
const embed = async (texts) => {
  if (!_defaultEmbed) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    _defaultEmbed = createEmbedder(genAI.getGenerativeModel({ model: EMBED_MODEL }));
  }
  return _defaultEmbed(texts);
};

module.exports = { createEmbedder, embed, EMBED_MODEL };
