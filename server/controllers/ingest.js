const { chunk } = require('../rag/chunker');
const { getStore } = require('../rag');
const { embed: defaultEmbed } = require('../rag/embeddings');

exports.ingest = async (req, res) => {
  try {
    const { userId, url, blocks } = req.body;
    if (!userId || !url || !Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ message: 'Missing required fields: userId, url, blocks[]' });
    }

    const store = req.app.locals.ragStore || getStore();
    const embed = req.app.locals.ragEmbed || defaultEmbed;

    const chunks = chunk(blocks);
    const vectors = await embed(chunks.map((c) => c.content));
    await store.upsert(userId, url, chunks, vectors);

    res.json({ message: 'Page ingested', chunkCount: chunks.length });
  } catch (error) {
    console.error('Error ingesting page:', error);
    res.status(500).json({ message: 'Error ingesting page', error: error.message });
  }
};
