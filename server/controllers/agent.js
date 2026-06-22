const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createTools } = require('../agent/tools');
const { createGeminiChat } = require('../agent/geminiChat');
const { runAgent } = require('../agent/orchestrator');
const { getStore } = require('../rag');
const { embed: defaultEmbed } = require('../rag/embeddings');

const GEMINI_KEY = process.env.GEMINI_KEY;
// Raw-cosine relevance floor (both stores report raw cosine in [-1,1]). Tuned
// conservatively for text-embedding-004: relevant passages typically score
// ~0.5-0.8, clearly off-topic ~0.3 or below. Override with RAG_MIN_SCORE.
const MIN_SCORE = process.env.RAG_MIN_SCORE ? Number(process.env.RAG_MIN_SCORE) : 0.4;
const MAX_STEPS = 5;

const SYSTEM_INSTRUCTION =
  'You are a reading assistant for the page the user is viewing. ' +
  'Always ground answers in the page: call the tools to retrieve or act on page content ' +
  'before answering, and cite the [n] passage indices you used. ' +
  'If the tools return no relevant content, say the page does not cover the request.';

const defaultGenerate = async (prompt) => {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

const defaultAnalyzeImage = async (prompt, image) => {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent([
    { inlineData: { mimeType: image.mimeType, data: image.data } },
    { text: prompt },
  ]);
  return result.response.text().trim();
};

// Validate an optional attached image payload.
const isValidImage = (image) =>
  image &&
  typeof image.mimeType === 'string' &&
  image.mimeType.startsWith('image/') &&
  typeof image.data === 'string' &&
  image.data.length > 0;

exports.agent = async (req, res) => {
  try {
    const { userId, url, goal, question, image } = req.body;
    if (!userId || !url || (!goal && !question)) {
      return res.status(400).json({ message: 'Missing required fields: userId, url, and goal or question' });
    }
    if (image !== undefined && !isValidImage(image)) {
      return res.status(400).json({ message: 'Invalid image: expected { mimeType: "image/*", data: <base64> }' });
    }

    const store = req.app.locals.ragStore || getStore();
    const embed = req.app.locals.ragEmbed || defaultEmbed;
    const generate = req.app.locals.ragGenerate || defaultGenerate;
    const analyzeImageFn = req.app.locals.ragAnalyzeImage || defaultAnalyzeImage;

    const { declarations, handlers } = createTools({
      userId, url, store, embed, generate, analyzeImageFn, image, minScore: MIN_SCORE,
    });
    const chat = req.app.locals.agentChat ||
      createGeminiChat({ apiKey: GEMINI_KEY, systemInstruction: SYSTEM_INSTRUCTION, declarations });

    const imageNote = image ? '\n(A screenshot of the page is attached; use analyzeImage for visual questions.)' : '';
    const userTurn = `Goal: ${goal || '(none)'}\nQuestion: ${question || '(none)'}${imageNote}`;
    const out = await runAgent({ chat, handlers, userTurn, maxSteps: MAX_STEPS });

    res.json({ message: 'Agent run complete', ...out });
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({ message: 'Error running agent', error: error.message });
  }
};
