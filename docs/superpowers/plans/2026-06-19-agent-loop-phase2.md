# Agent Loop (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded Gemini function-calling agent (`POST /api/agent`) that plans → calls RAG tools → observes → answers, returning a grounded answer with citations and a transparent tool trace.

**Architecture:** A `server/agent/` module: `tools.js` (RAG-backed tool handlers + Gemini function declarations), `orchestrator.js` (the bounded loop, driven by an injectable chat adapter), and `geminiChat.js` (adapter wiring the real Gemini model). A new `controllers/agent.js` + `POST /api/agent` route wire it together; the four legacy task endpoints stay untouched. All Gemini/chat dependencies are injected via `req.app.locals`/factory args so the whole loop is unit-testable with no network. Also closes the Phase-1-deferred relevance-score floor in `retrieveContext`.

**Tech Stack:** Node.js, Express, `@google/generative-ai` ^0.21.0 (function calling via `getGenerativeModel({tools})` + `startChat`/`sendMessage`), Jest. Reuses Phase 1 `server/rag/`.

---

## File Structure

- Modify `server/rag/index.js` — add `minScore` relevance floor to `retrieveContext`.
- Create `server/agent/tools.js` — `createTools({...})` → `{ declarations, handlers }`. Four tools: `retrieve`, `summarize`, `explainSentence`, `highlightRelevant`, each bound to a `(userId,url)` and backed by the RAG core.
- Create `server/agent/orchestrator.js` — `runAgent({chat, handlers, userTurn, maxSteps})` bounded loop returning `{answer, citations, toolTrace, steps}`.
- Create `server/agent/geminiChat.js` — `makeChatFromModel(model)` (testable adapter) + `createGeminiChat(config)` (real Gemini wiring).
- Create `server/controllers/agent.js` — `POST /api/agent` controller.
- Modify `server/routes/taskRoutes.js` — add `router.post('/agent', ...)`.
- Create `server/agent/__tests__/*.test.js` — unit tests (no network).

Conventions: CommonJS, 2-space indent, controllers `exports.fn = async (req,res)=>{}` with `res.status(400).json({message})` on bad input. Tools/loop dependencies always injectable.

---

### Task 1: Relevance-score floor in `retrieveContext`

Closes the Phase-1-deferred gap: drop retrieved hits whose similarity is below a floor so an off-topic page yields "no relevant content" instead of weak matches. Default `minScore: 0` preserves existing behavior.

**Files:**
- Modify: `server/rag/index.js`
- Test: `server/rag/__tests__/index.test.js` (append)

- [ ] **Step 1: Add the failing test**

Append to `server/rag/__tests__/index.test.js`:

```js
test('retrieveContext drops hits below minScore', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 0, content: 'on topic' }, { index: 1, content: 'off topic' }],
    [[1, 0], [0, 1]]);
  const embed = async () => [[1, 0]]; // scores: index0=1.0, index1=0.0

  const { citations, context } = await retrieveContext({
    store, embed, userId: 'u1', url: 'http://x', query: 'q', k: 5, minScore: 0.5,
  });

  expect(citations).toEqual([0]);
  expect(context).toBe('[0] on topic');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest rag/__tests__/index`
Expected: FAIL — the new test gets `citations: [0, 1]` (no floor applied).

- [ ] **Step 3: Implement the floor**

In `server/rag/index.js`, replace the `retrieveContext` function with:

```js
// Embed the query, retrieve top-k, drop hits below minScore, and format
// grounded context + citation indices.
const retrieveContext = async ({ store, embed: embedFn = embed, userId, url, query, k = 5, minScore = 0 }) => {
  const [queryVector] = await embedFn([query]);
  const allHits = await store.retrieve(userId, url, queryVector, k);
  const hits = allHits.filter((h) => h.score >= minScore);
  const context = hits.map((h) => `[${h.index}] ${h.content}`).join('\n');
  const citations = hits.map((h) => h.index);
  return { context, citations, hits };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest rag/__tests__/index`
Expected: PASS (4 tests — the 3 existing + the new floor test). The existing `k=1` test still passes because its single hit has score 1.0 ≥ default 0.

- [ ] **Step 5: Commit**

```bash
git add server/rag/index.js server/rag/__tests__/index.test.js
git commit -m "feat: add relevance-score floor to retrieveContext"
```

---

### Task 2: Agent tools

`createTools` binds a `(userId, url)` and the RAG dependencies into four tool handlers and exposes their Gemini function declarations. `retrieve` and `highlightRelevant` return data/indices; `summarize` and `explainSentence` wrap a `generate(prompt)` call over retrieved context. Each handler returns `citations` (or `indices`) so the orchestrator can aggregate them.

**Files:**
- Create: `server/agent/tools.js`
- Test: `server/agent/__tests__/tools.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/agent/__tests__/tools.test.js`:

```js
const { createTools } = require('../tools');
const { createMemoryStore } = require('../../rag/memoryStore');

const setup = () => {
  const store = createMemoryStore();
  const embed = async () => [[1, 0]];
  const generate = jest.fn(async () => 'GENERATED');
  return { store, embed, generate };
};

const seed = (store) =>
  store.upsert('u1', 'http://x',
    [{ index: 2, content: 'The river flooded the town.' }], [[1, 0]]);

test('declarations expose the four tool names', () => {
  const { declarations } = createTools({ userId: 'u1', url: 'http://x' });
  expect(declarations.map((d) => d.name).sort()).toEqual(
    ['explainSentence', 'highlightRelevant', 'retrieve', 'summarize']
  );
});

test('retrieve returns numbered context + citations', async () => {
  const { store, embed, generate } = setup();
  await seed(store);
  const { handlers } = createTools({ userId: 'u1', url: 'http://x', store, embed, generate });
  const out = await handlers.retrieve({ query: 'flood' });
  expect(out.citations).toEqual([2]);
  expect(out.context).toContain('[2] The river flooded the town.');
});

test('summarize generates over retrieved context and returns citations', async () => {
  const { store, embed, generate } = setup();
  await seed(store);
  const { handlers } = createTools({ userId: 'u1', url: 'http://x', store, embed, generate });
  const out = await handlers.summarize({ goal: 'flood' });
  expect(generate).toHaveBeenCalled();
  expect(out.result).toBe('GENERATED');
  expect(out.citations).toEqual([2]);
});

test('explainSentence on unindexed page returns no-content without calling generate', async () => {
  const { store, embed, generate } = setup(); // nothing seeded
  const { handlers } = createTools({ userId: 'u1', url: 'http://none', store, embed, generate });
  const out = await handlers.explainSentence({ sentence: 'x' });
  expect(generate).not.toHaveBeenCalled();
  expect(out.result).toMatch(/no relevant content/i);
  expect(out.citations).toEqual([]);
});

test('highlightRelevant returns chunk indices', async () => {
  const { store, embed, generate } = setup();
  await seed(store);
  const { handlers } = createTools({ userId: 'u1', url: 'http://x', store, embed, generate });
  const out = await handlers.highlightRelevant({ goal: 'flood' });
  expect(out.indices).toEqual([2]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest agent/__tests__/tools`
Expected: FAIL — "Cannot find module '../tools'".

- [ ] **Step 3: Write minimal implementation**

Create `server/agent/tools.js`:

```js
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

const NO_CONTENT = 'no relevant content found on this page';

// Bind (userId,url) + RAG deps into concrete tool handlers.
const createTools = ({ userId, url, store, embed, generate, k = 5, minScore = 0 }) => {
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

  return { declarations, handlers };
};

module.exports = { createTools, declarations };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest agent/__tests__/tools`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/agent/tools.js server/agent/__tests__/tools.test.js
git commit -m "feat: add agent RAG tools + Gemini function declarations"
```

---

### Task 3: Agent orchestrator (bounded loop)

`runAgent` drives a chat adapter: send the user turn, execute any returned function calls via `handlers`, feed results back, repeat until the model returns a text answer or `maxSteps` is hit. Aggregates citations (from `citations` or `indices` in each tool result) and records a `toolTrace`.

**Files:**
- Create: `server/agent/orchestrator.js`
- Test: `server/agent/__tests__/orchestrator.test.js`

The chat adapter contract: `chat.send(parts) → { functionCalls: [{name, args}] | null, text: string | null }`. `parts` is an array of `{text}` (first turn) or `{functionResponse:{name, response}}` (subsequent turns).

- [ ] **Step 1: Write the failing test**

Create `server/agent/__tests__/orchestrator.test.js`:

```js
const { runAgent } = require('../orchestrator');

test('runs a tool then returns the final answer with citations and trace', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'retrieve', args: { query: 'flood' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'A flood hit the town.' }),
  };
  const handlers = {
    retrieve: jest.fn(async () => ({ context: '[2] flood', citations: [2] })),
  };

  const out = await runAgent({ chat, handlers, userTurn: 'Goal: flood', maxSteps: 5 });

  expect(out.answer).toBe('A flood hit the town.');
  expect(out.citations).toEqual([2]);
  expect(out.steps).toBe(1);
  expect(out.toolTrace).toEqual([
    { tool: 'retrieve', args: { query: 'flood' }, result: { context: '[2] flood', citations: [2] } },
  ]);
  // first send is the user turn, second is the function response
  expect(chat.send).toHaveBeenCalledTimes(2);
  expect(chat.send.mock.calls[1][0]).toEqual([
    { functionResponse: { name: 'retrieve', response: { context: '[2] flood', citations: [2] } } },
  ]);
});

test('aggregates citations from indices and dedupes across tools', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'highlightRelevant', args: { goal: 'g' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: [{ name: 'retrieve', args: { query: 'g' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'done' }),
  };
  const handlers = {
    highlightRelevant: async () => ({ indices: [2, 4] }),
    retrieve: async () => ({ context: 'c', citations: [4, 6] }),
  };

  const out = await runAgent({ chat, handlers, userTurn: 'x', maxSteps: 5 });
  expect(out.citations).toEqual([2, 4, 6]);
  expect(out.steps).toBe(2);
});

test('stops at maxSteps when the model never finalizes', async () => {
  const chat = {
    send: jest.fn().mockResolvedValue({ functionCalls: [{ name: 'retrieve', args: {} }], text: null }),
  };
  const handlers = { retrieve: async () => ({ citations: [] }) };

  const out = await runAgent({ chat, handlers, userTurn: 'x', maxSteps: 3 });
  expect(out.steps).toBe(3);
  expect(out.answer).toMatch(/step limit/i);
});

test('unknown tool call is reported back as an error result, loop continues', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'bogus', args: {} }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'recovered' }),
  };
  const out = await runAgent({ chat, handlers: {}, userTurn: 'x', maxSteps: 5 });
  expect(out.answer).toBe('recovered');
  expect(out.toolTrace[0].result).toEqual({ error: 'unknown tool: bogus' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest agent/__tests__/orchestrator`
Expected: FAIL — "Cannot find module '../orchestrator'".

- [ ] **Step 3: Write minimal implementation**

Create `server/agent/orchestrator.js`:

```js
// Drive a chat adapter through a bounded function-calling loop.
// chat.send(parts) -> { functionCalls: [{name,args}]|null, text: string|null }
const runAgent = async ({ chat, handlers, userTurn, maxSteps = 5 }) => {
  const toolTrace = [];
  const citations = [];
  const addCitations = (arr) => {
    for (const i of arr || []) if (!citations.includes(i)) citations.push(i);
  };

  let response = await chat.send([{ text: userTurn }]);
  let steps = 0;

  while (steps < maxSteps) {
    const calls = response.functionCalls || [];
    if (calls.length === 0) {
      return { answer: response.text || '', citations, toolTrace, steps };
    }

    const parts = [];
    for (const call of calls) {
      const handler = handlers[call.name];
      const result = handler
        ? await handler(call.args || {})
        : { error: `unknown tool: ${call.name}` };
      addCitations(result.citations || result.indices);
      toolTrace.push({ tool: call.name, args: call.args, result });
      parts.push({ functionResponse: { name: call.name, response: result } });
    }

    steps += 1;
    response = await chat.send(parts);
  }

  // Hit the step ceiling. Return whatever text the model last produced, else a notice.
  const answer = (response.functionCalls && response.functionCalls.length)
    ? 'Reached step limit before completing.'
    : (response.text || 'Reached step limit before completing.');
  return { answer, citations, toolTrace, steps };
};

module.exports = { runAgent };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest agent/__tests__/orchestrator`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/agent/orchestrator.js server/agent/__tests__/orchestrator.test.js
git commit -m "feat: add bounded agent orchestrator loop"
```

---

### Task 4: Gemini chat adapter

`makeChatFromModel(model)` turns a `@google/generative-ai` generative model into the orchestrator's `chat` contract. `createGeminiChat(config)` constructs the real model (with tool declarations + system instruction) and wraps it. Only `makeChatFromModel` is unit-tested (the real wiring needs a network/key, covered by the Task 6 manual smoke test).

**Files:**
- Create: `server/agent/geminiChat.js`
- Test: `server/agent/__tests__/geminiChat.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/agent/__tests__/geminiChat.test.js`:

```js
const { makeChatFromModel } = require('../geminiChat');

test('maps a function-call response then a text response', async () => {
  const sendMessage = jest.fn()
    .mockResolvedValueOnce({ response: { functionCalls: () => [{ name: 'retrieve', args: { query: 'x' } }], text: () => '' } })
    .mockResolvedValueOnce({ response: { functionCalls: () => [], text: () => 'final answer' } });
  const model = { startChat: () => ({ sendMessage }) };

  const chat = makeChatFromModel(model);
  const first = await chat.send([{ text: 'hi' }]);
  expect(first.functionCalls).toEqual([{ name: 'retrieve', args: { query: 'x' } }]);
  expect(first.text).toBeNull();

  const second = await chat.send([{ functionResponse: { name: 'retrieve', response: {} } }]);
  expect(second.functionCalls).toBeNull();
  expect(second.text).toBe('final answer');
});

test('handles SDKs where functionCalls() returns undefined', async () => {
  const sendMessage = jest.fn().mockResolvedValue({ response: { functionCalls: () => undefined, text: () => 'plain' } });
  const model = { startChat: () => ({ sendMessage }) };
  const chat = makeChatFromModel(model);
  const out = await chat.send([{ text: 'hi' }]);
  expect(out.functionCalls).toBeNull();
  expect(out.text).toBe('plain');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest agent/__tests__/geminiChat`
Expected: FAIL — "Cannot find module '../geminiChat'".

- [ ] **Step 3: Write minimal implementation**

Create `server/agent/geminiChat.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest agent/__tests__/geminiChat`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/agent/geminiChat.js server/agent/__tests__/geminiChat.test.js
git commit -m "feat: add Gemini chat adapter for the agent loop"
```

---

### Task 5: `/api/agent` controller + route

Wires tools + chat + orchestrator behind one endpoint. The chat, store, embed, and generate are injected via `req.app.locals` when present (tests) and default to the real Gemini-backed implementations otherwise.

**Files:**
- Create: `server/controllers/agent.js`
- Modify: `server/routes/taskRoutes.js`
- Test: `server/agent/__tests__/agentController.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/agent/__tests__/agentController.test.js`:

```js
const { agent } = require('../../controllers/agent');
const { createMemoryStore } = require('../../rag/memoryStore');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('400 when userId/url missing', async () => {
  const res = mockRes();
  await agent({ body: { goal: 'x' }, app: { locals: {} } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('runs the agent end to end with injected chat + store', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 2, content: 'The river flooded the town.' }], [[1, 0]]);

  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'retrieve', args: { query: 'flood' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'A flood hit the town.' }),
  };

  const req = {
    body: { userId: 'u1', url: 'http://x', goal: 'understand the flood' },
    app: { locals: {
      ragStore: store,
      ragEmbed: async () => [[1, 0]],
      ragGenerate: async () => 'unused here',
      agentChat: chat,
    } },
  };
  const res = mockRes();
  await agent(req, res);

  const payload = res.json.mock.calls[0][0];
  expect(payload.answer).toBe('A flood hit the town.');
  expect(payload.citations).toEqual([2]);
  expect(payload.toolTrace[0].tool).toBe('retrieve');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest agentController`
Expected: FAIL — "Cannot find module '../../controllers/agent'".

- [ ] **Step 3: Write minimal implementation**

Create `server/controllers/agent.js`:

```js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createTools } = require('../agent/tools');
const { createGeminiChat } = require('../agent/geminiChat');
const { runAgent } = require('../agent/orchestrator');
const { getStore } = require('../rag');
const { embed: defaultEmbed } = require('../rag/embeddings');

const GEMINI_KEY = process.env.GEMINI_KEY;
const MIN_SCORE = process.env.RAG_MIN_SCORE ? Number(process.env.RAG_MIN_SCORE) : 0.5;
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

exports.agent = async (req, res) => {
  try {
    const { userId, url, goal, question } = req.body;
    if (!userId || !url || (!goal && !question)) {
      return res.status(400).json({ message: 'Missing required fields: userId, url, and goal or question' });
    }

    const store = req.app.locals.ragStore || getStore();
    const embed = req.app.locals.ragEmbed || defaultEmbed;
    const generate = req.app.locals.ragGenerate || defaultGenerate;

    const { declarations, handlers } = createTools({ userId, url, store, embed, generate, minScore: MIN_SCORE });
    const chat = req.app.locals.agentChat ||
      createGeminiChat({ apiKey: GEMINI_KEY, systemInstruction: SYSTEM_INSTRUCTION, declarations });

    const userTurn = `Goal: ${goal || '(none)'}\nQuestion: ${question || '(none)'}`;
    const out = await runAgent({ chat, handlers, userTurn, maxSteps: MAX_STEPS });

    res.json({ message: 'Agent run complete', ...out });
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({ message: 'Error running agent', error: error.message });
  }
};
```

- [ ] **Step 4: Wire the route**

Edit `server/routes/taskRoutes.js` — add near the other controller requires and routes:

```js
const agentController = require('../controllers/agent');
```
```js
router.post('/agent', agentController.agent);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest agentController`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify the route file parses**

Run: `cd server && node -e "require('./routes/taskRoutes'); console.log('ok')"`
Expected: prints `ok` (mongoose model-overwrite warnings are acceptable; must not throw).

- [ ] **Step 7: Run the full suite**

Run: `cd server && npx jest`
Expected: PASS — all suites green (Phase 1 + new agent suites).

- [ ] **Step 8: Commit**

```bash
git add server/controllers/agent.js server/routes/taskRoutes.js server/agent/__tests__/agentController.test.js
git commit -m "feat: add /api/task/agent endpoint (function-calling agent loop)"
```

---

### Task 6: Manual end-to-end smoke test (real Gemini function calling)

**Files:** none (verification only). Requires a valid `GEMINI_KEY` in `server/.env`.

- [ ] **Step 1: Start the server**

Run: `cd server && RAG_STORE=memory npm run start-server`
Expected: `Express server running...` and `MongoDB connected successfully`.

- [ ] **Step 2: Ingest a page**

Run:
```bash
curl -s -X POST http://localhost:3030/api/task/ingest \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1","url":"http://demo","blocks":[{"index":0,"content":"The Eiffel Tower is in Paris and was completed in 1889."},{"index":1,"content":"It was the tallest structure in the world until 1930."}]}'
```
Expected: `{"message":"Page ingested","chunkCount":...}`.

- [ ] **Step 3: Run the agent**

Run:
```bash
curl -s -X POST http://localhost:3030/api/task/agent \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1","url":"http://demo","goal":"when was it built","question":"When was the Eiffel Tower completed?"}'
```
Expected: JSON with `answer` mentioning 1889, a non-empty `citations` array, and a `toolTrace` showing at least one tool call (e.g. `retrieve`).

- [ ] **Step 4: Confirm graceful handling of an unindexed page**

Run the agent call with `"url":"http://not-indexed"`.
Expected: an `answer` indicating the page doesn't cover the request; `toolTrace` shows tools returning no content; no crash.

- [ ] **Step 5: Stop the server** (Ctrl-C). No commit (verification only).

---

## Self-Review

**Spec coverage (Phase 2 scope from the design):**
- `server/agent/` orchestrator (bounded function-calling loop) → Task 3. ✓
- Agent tools (`retrieve`, `summarize`, `explainSentence`, `highlightRelevant`) backed by the RAG core → Task 2. ✓
- `POST /api/agent` endpoint, legacy routes kept untouched → Task 5 (only adds a route). ✓
- `toolTrace` + bounded `MAX_STEPS` + citations in the response → Tasks 3 & 5. ✓
- Centralized relevance/safety system instruction → Task 5 (`SYSTEM_INSTRUCTION`). ✓
- Relevance-score floor (Phase-1 deferred) → Task 1. ✓
- `analyzeImage`/multimodal explicitly deferred to Phase 3 (not in this plan). Intentional.
- Tests run without network/Atlas/key; Task 6 is the only network test. ✓

**Type/interface consistency:**
- Chat adapter contract `send(parts) → {functionCalls|null, text|null}` is identical in `geminiChat.js` (Task 4), `orchestrator.js` (Task 3), and all injected test fakes. ✓
- Tool handler results expose `citations` or `indices`; orchestrator's `addCitations` reads both (Task 3) and tools produce them (Task 2). ✓
- `createTools({userId,url,store,embed,generate,k,minScore})` signature used identically by tests (Task 2) and the controller (Task 5). ✓
- `retrieveContext({...,minScore})` added in Task 1 and consumed by `tools.js` in Task 2. ✓
- `req.app.locals` injection keys (`ragStore`, `ragEmbed`, `ragGenerate`, `agentChat`) consistent between controller (Task 5) and tests. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓
