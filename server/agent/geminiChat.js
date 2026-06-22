const { GoogleGenerativeAI } = require('@google/generative-ai');

// Adapt a @google/generative-ai model into the orchestrator's chat contract.
const makeChatFromModel = (model) => {
  const chat = model.startChat();
  return {
    async send(parts) {
      const result = await chat.sendMessage(parts);
      const resp = result.response;
      const raw = typeof resp.functionCalls === 'function' ? resp.functionCalls() : resp.functionCalls;
      const calls = Array.isArray(raw) ? raw : [];
      return calls.length > 0
        ? { functionCalls: calls, text: null }
        : { functionCalls: null, text: resp.text() };
    },
  };
};

// Build a real Gemini-backed chat with tool declarations + a system instruction.
const createGeminiChat = ({ apiKey, model = 'gemini-1.5-flash', systemInstruction, declarations }) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction,
    tools: [{ functionDeclarations: declarations }],
  });
  return makeChatFromModel(generativeModel);
};

module.exports = { makeChatFromModel, createGeminiChat };
