const { retrieveContext } = require('../rag');

// Gemini function declarations for the agent's tools.
const declarations = [
  {
    name: 'retrieve',
    description: 'Retrieve the most relevant passages from the current page for a query. Returns numbered context and the source indices.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to search the page for' } },
      required: ['query'],
    },
  },
  {
    name: 'summarize',
    description: 'Summarize the current page for a reading goal, grounded only on retrieved passages.',
    parameters: {
      type: 'object',
      properties: { goal: { type: 'string', description: "The reader's goal" } },
      required: ['goal'],
    },
  },
  {
    name: 'explainSentence',
    description: 'Explain a sentence or phrase using the surrounding page context.',
    parameters: {
      type: 'object',
      properties: { sentence: { type: 'string', description: 'The sentence to explain' } },
      required: ['sentence'],
    },
  },
  {
    name: 'highlightRelevant',
    description: 'Return the indices of the page passages most relevant to a goal, for highlighting.',
    parameters: {
      type: 'object',
      properties: { goal: { type: 'string', description: "The reader's goal" } },
      required: ['goal'],
    },
  },
];

const visionDeclaration = {
  name: 'analyzeImage',
  description: 'Analyze the attached screenshot of the page to answer visual questions ' +
    '(charts, diagrams, images, layout). Use this when the question is about visuals rather than text.',
  parameters: {
    type: 'object',
    properties: { prompt: { type: 'string', description: 'What to look for in the image' } },
    required: ['prompt'],
  },
};

const NO_CONTENT = 'no relevant content found on this page';

// Bind (userId,url) + RAG deps into concrete tool handlers.
const createTools = ({ userId, url, store, embed, generate, analyzeImageFn, image, k = 5, minScore = 0 }) => {
  const ctx = (query) => retrieveContext({ store, embed, userId, url, query, k, minScore });

  const handlers = {
    async retrieve({ query }) {
      const { context, citations } = await ctx(query);
      return { context, citations };
    },

    async summarize({ goal }) {
      const { context, citations } = await ctx(goal);
      if (!context) return { result: NO_CONTENT, citations: [] };
      const prompt = `Summarize the page for the goal "${goal}" in under 150 words. ` +
        `Use ONLY the numbered context below and cite the [n] indices you used.\n\nContext:\n${context}`;
      const result = await generate(prompt);
      return { result, citations };
    },

    async explainSentence({ sentence }) {
      const { context, citations } = await ctx(sentence);
      if (!context) return { result: NO_CONTENT, citations: [] };
      const prompt = `Explain "${sentence}" in under 100 words using ONLY the numbered ` +
        `context below and cite the [n] indices you used.\n\nContext:\n${context}`;
      const result = await generate(prompt);
      return { result, citations };
    },

    async highlightRelevant({ goal }) {
      const { citations } = await ctx(goal);
      return { indices: citations };
    },
  };

  const toolDeclarations = [...declarations];
  if (image) {
    toolDeclarations.push(visionDeclaration);
    handlers.analyzeImage = async ({ prompt }) => {
      const result = await analyzeImageFn(prompt, image);
      return { result, source: 'vision' };
    };
  }

  return { declarations: toolDeclarations, handlers };
};

module.exports = { createTools, declarations };
