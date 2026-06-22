# Multimodal Vision + Docs (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "multimodal" real — add an `analyzeImage` vision tool to the agent so it can reason over an attached page screenshot via Gemini vision, exercisable end-to-end through `POST /api/task/agent` — and ship the reference-app docs (README + architecture diagram).

**Architecture:** Extend the Phase 2 agent: `createTools` gains an optional attached `image` and an injected `analyzeImageFn`; when an image is present it exposes an extra `analyzeImage` Gemini function declaration whose handler sends the image to a vision model. The `/api/task/agent` controller accepts an optional `image: {mimeType, data}`, validates it, and wires a default Gemini vision call. Vision answers are flagged `source: 'vision'` and are NOT chunk-cited (kept distinct from RAG-grounded text). Everything stays injectable so it's unit-testable with no network. Plus a README rewrite and `docs/architecture.md` with a Mermaid diagram.

**Tech Stack:** Node.js, Express, `@google/generative-ai` ^0.21 (multimodal `generateContent([{inlineData},{text}])`), Jest. Reuses Phase 1–2 `server/rag/` + `server/agent/`.

**Out of scope (Phase 4 — needs a browser):** Chrome extension Panel/Background changes — screenshot capture via `chrome.tabs.captureVisibleTab`, calling `/ingest` + `/agent` from the Panel, rendering citations/highlights. Those use `chrome.*` APIs that can't be unit-tested headlessly and require manual in-browser verification.

---

## File Structure

- Modify `server/agent/tools.js` — `createTools` accepts optional `image` + `analyzeImageFn`; conditionally adds the `analyzeImage` tool.
- Modify `server/controllers/agent.js` — accept + validate optional `image`, wire `defaultAnalyzeImage`, note the attached image in the user turn.
- Modify `server/agent/__tests__/tools.test.js` and `server/agent/__tests__/agentController.test.js` — add coverage.
- Rewrite `README.md` — pitch, architecture, "how the RAG + agent works", API contracts, local-run guide.
- Create `docs/architecture.md` — data-flow narrative + Mermaid diagram.

Conventions: CommonJS, 2-space indent, backtick template literals for any interpolated strings, deps injectable via args / `req.app.locals`.

---

### Task 1: `analyzeImage` vision tool

`createTools` gains optional `image` (the attached `{mimeType, data}`) and `analyzeImageFn(prompt, image) → string`. When `image` is truthy, the returned `declarations` include an `analyzeImage` function and `handlers.analyzeImage` calls `analyzeImageFn`, returning `{ result, source: 'vision' }` (no citations — vision answers aren't chunk-grounded). When no image is attached, the tool is absent.

**Files:**
- Modify: `server/agent/tools.js`
- Test: `server/agent/__tests__/tools.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `server/agent/__tests__/tools.test.js`:

```js
test('analyzeImage tool is absent when no image is attached', () => {
  const { declarations, handlers } = createTools({ userId: 'u1', url: 'http://x' });
  expect(declarations.map((d) => d.name)).not.toContain('analyzeImage');
  expect(handlers.analyzeImage).toBeUndefined();
});

test('analyzeImage tool is present and calls the vision fn when an image is attached', async () => {
  const image = { mimeType: 'image/png', data: 'BASE64' };
  const analyzeImageFn = jest.fn(async () => 'A bar chart of revenue.');
  const { declarations, handlers } = createTools({
    userId: 'u1', url: 'http://x', image, analyzeImageFn,
  });

  expect(declarations.map((d) => d.name)).toContain('analyzeImage');

  const out = await handlers.analyzeImage({ prompt: 'what does the chart show?' });
  expect(analyzeImageFn).toHaveBeenCalledWith('what does the chart show?', image);
  expect(out.result).toBe('A bar chart of revenue.');
  expect(out.source).toBe('vision');
  expect(out.citations).toBeUndefined(); // vision answers are not chunk-cited
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest agent/__tests__/tools`
Expected: FAIL — `analyzeImage` is present even without an image / handler undefined with one (current code has no vision tool).

- [ ] **Step 3: Implement**

In `server/agent/tools.js`, add the vision declaration as a module-level const after the existing `declarations` array:

```js
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
```

Then change the `createTools` signature and its return to conditionally add the tool. Replace the `createTools` declaration line and its final `return`:

```js
const createTools = ({ userId, url, store, embed, generate, analyzeImageFn, image, k = 5, minScore = 0 }) => {
```

…and at the end of the function, replace `return { declarations, handlers };` with:

```js
  const toolDeclarations = [...declarations];
  if (image) {
    toolDeclarations.push(visionDeclaration);
    handlers.analyzeImage = async ({ prompt }) => {
      const result = await analyzeImageFn(prompt, image);
      return { result, source: 'vision' };
    };
  }

  return { declarations: toolDeclarations, handlers };
```

(Keep the four existing handlers and `module.exports = { createTools, declarations };` unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest agent/__tests__/tools`
Expected: PASS (7 tests — 5 existing + 2 new). The existing "four tool names" test still passes because no `image` is passed there.

- [ ] **Step 5: Commit**

```bash
git add server/agent/tools.js server/agent/__tests__/tools.test.js
git commit -m "feat: add analyzeImage vision tool to the agent"
```

---

### Task 2: `/api/agent` image plumbing + validation

The controller accepts an optional `image: {mimeType, data}`, validates it (must be an `image/*` mime with non-empty base64 `data`), wires a `defaultAnalyzeImage` Gemini vision call, passes `image` + `analyzeImageFn` into `createTools`, and tells the model in the user turn that a screenshot is attached. Vision deps are injectable via `req.app.locals.ragAnalyzeImage`.

**Files:**
- Modify: `server/controllers/agent.js`
- Test: `server/agent/__tests__/agentController.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `server/agent/__tests__/agentController.test.js`:

```js
test('400 when image is malformed (missing data)', async () => {
  const res = mockRes();
  await agent(
    { body: { userId: 'u1', url: 'http://x', goal: 'g', image: { mimeType: 'image/png' } }, app: { locals: {} } },
    res
  );
  expect(res.status).toHaveBeenCalledWith(400);
});

test('runs the agent with an attached image via analyzeImage', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'analyzeImage', args: { prompt: 'describe the chart' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'It is a revenue bar chart.' }),
  };
  const req = {
    body: {
      userId: 'u1', url: 'http://x', question: 'what does the chart show?',
      image: { mimeType: 'image/png', data: 'BASE64DATA' },
    },
    app: { locals: {
      ragStore: require('../../rag/memoryStore').createMemoryStore(),
      ragEmbed: async () => [[1, 0]],
      ragGenerate: async () => 'unused',
      ragAnalyzeImage: async () => 'It is a revenue bar chart.',
      agentChat: chat,
    } },
  };
  const res = mockRes();
  await agent(req, res);

  const payload = res.json.mock.calls[0][0];
  expect(payload.answer).toBe('It is a revenue bar chart.');
  expect(payload.toolTrace[0].tool).toBe('analyzeImage');
  expect(payload.toolTrace[0].result.source).toBe('vision');
  expect(payload.citations).toEqual([]); // vision is not chunk-cited
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest agentController`
Expected: FAIL — controller ignores `image` (no 400 for malformed image; no `analyzeImageFn` wired).

- [ ] **Step 3: Implement**

In `server/controllers/agent.js`:

(a) Add a `defaultAnalyzeImage` after `defaultGenerate`:

```js
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
```

(b) In `exports.agent`, after destructuring add `image` and validate it:

```js
    const { userId, url, goal, question, image } = req.body;
    if (!userId || !url || (!goal && !question)) {
      return res.status(400).json({ message: 'Missing required fields: userId, url, and goal or question' });
    }
    if (image !== undefined && !isValidImage(image)) {
      return res.status(400).json({ message: 'Invalid image: expected { mimeType: "image/*", data: <base64> }' });
    }
```

(c) Wire the vision fn and pass image into `createTools`:

```js
    const generate = req.app.locals.ragGenerate || defaultGenerate;
    const analyzeImageFn = req.app.locals.ragAnalyzeImage || defaultAnalyzeImage;

    const { declarations, handlers } = createTools({
      userId, url, store, embed, generate, analyzeImageFn, image, minScore: MIN_SCORE,
    });
```

(d) Note the attached image in the user turn:

```js
    const imageNote = image ? '\n(A screenshot of the page is attached; use analyzeImage for visual questions.)' : '';
    const userTurn = `Goal: ${goal || '(none)'}\nQuestion: ${question || '(none)'}${imageNote}`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest agentController`
Expected: PASS (4 tests — 2 existing + 2 new).

- [ ] **Step 5: Verify the route still parses + run the full suite**

Run: `cd server && node -e "require('./routes/taskRoutes'); console.log('ok')"`
Expected: prints `ok`.
Run: `cd server && npx jest`
Expected: PASS — all suites green.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/agent.js server/agent/__tests__/agentController.test.js
git commit -m "feat: accept optional image in /api/task/agent for multimodal vision"
```

---

### Task 3: README + architecture docs

Rewrite `README.md` as the reference-app front door and add `docs/architecture.md` with a Mermaid diagram. No code; verify Markdown/Mermaid is well-formed and internal links resolve.

**Files:**
- Modify: `README.md`
- Create: `docs/architecture.md`

- [ ] **Step 1: Write `docs/architecture.md`**

Create `docs/architecture.md`:

```markdown
# Architecture

AI Reading Partner is a RAG-shaped reference application: a Chrome extension that
extracts the page you're reading, and a Gemini-powered backend that retrieves the
most relevant passages and answers — grounded, with citations — through a bounded
agent loop.

## Data flow

​```mermaid
flowchart TD
  subgraph EXT[Chrome Extension]
    C[Content script<br/>extract-structured-text<br/>→ indexed DOM blocks]
    P[Panel UI<br/>goal · question · screenshot]
  end

  subgraph API[Express backend]
    I["/api/task/ingest<br/>chunk → embed → upsert"]
    A["/api/task/agent<br/>bounded Gemini<br/>function-calling loop"]
    subgraph TOOLS[Agent tools]
      R[retrieve]
      S[summarize]
      E[explainSentence]
      H[highlightRelevant]
      V[analyzeImage<br/>vision]
    end
    RC[RAG core<br/>retrieveContext<br/>top-k + minScore floor]
  end

  subgraph DB[MongoDB Atlas]
    CH[(chunks<br/>content + embedding<br/>vector index)]
  end

  C -->|blocks| I
  I -->|embeddings| CH
  P -->|goal/question/image| A
  A --> TOOLS
  R --> RC
  S --> RC
  E --> RC
  H --> RC
  RC -->|"$vectorSearch / cosine"| CH
  A -->|"answer + citations + toolTrace"| P
​```

## The three honest claims

- **RAG-grounded text.** Text answers retrieve top-k passages (Gemini
  `text-embedding-004`, cosine similarity with a `minScore` floor) and generate
  using only that context, returning the source chunk indices as citations.
- **Bounded agent.** `/api/task/agent` runs a Gemini function-calling loop
  (`MAX_STEPS=5`) that plans → calls tools → observes → answers, with a full
  `toolTrace` for transparency.
- **Multimodal, flagged.** When a screenshot is attached, the agent can call
  `analyzeImage` (Gemini vision). Vision answers are flagged `source: 'vision'`
  and are deliberately NOT chunk-cited — text answers are RAG-grounded, visual
  answers are vision-sourced.

## Storage

Chunk embeddings live in a MongoDB Atlas `chunks` collection with a vector search
index (`docs/atlas-vector-index.json`). The store backend is selected by
`RAG_STORE=atlas|memory`; an in-memory cosine store is a drop-in fallback. Both
report **raw cosine** scores so the `minScore` floor is backend-agnostic.
```

Note: in the actual file, the three ` ​``` ` Mermaid fences must be plain triple-backticks with no zero-width characters — write them as normal code fences.

- [ ] **Step 2: Rewrite `README.md`**

Replace the entire `README.md` with:

```markdown
# AI Reading Partner

A multimodal, agentic Chrome extension powered by the Gemini API — a compact,
RAG-shaped reference application demonstrating end-to-end GenAI product delivery:
DOM extraction in the browser, retrieval-augmented backend orchestration, and a
live reading-assistant UI.

## What it does

You set a reading goal or ask a question about the page you're on. The extension
extracts the page's text; the backend retrieves the most relevant passages and the
Gemini agent answers — grounded in those passages, with citations — and can
highlight the relevant sentences. With a screenshot attached, it can also answer
visual questions about charts and diagrams.

## How it works (RAG + agent)

1. **Ingest** — the content script extracts indexed DOM blocks; `/api/task/ingest`
   chunks them, embeds each chunk (`text-embedding-004`), and upserts to the vector
   store (keyed by user + page URL).
2. **Retrieve** — for a query, the RAG core embeds it and pulls the top-k most
   similar chunks (cosine, with a relevance floor).
3. **Agent** — `/api/task/agent` runs a bounded Gemini function-calling loop with
   tools: `retrieve`, `summarize`, `explainSentence`, `highlightRelevant`, and
   `analyzeImage` (vision). It returns `{ answer, citations, toolTrace, steps }`.

See [docs/architecture.md](docs/architecture.md) for the full data flow and diagram.

## Backend API

All routes are mounted under `/api/task`.

| Method · Route | Body | Returns |
|---|---|---|
| `POST /ingest` | `{ userId, url, blocks: [{index, content}] }` | `{ chunkCount }` |
| `POST /agent` | `{ userId, url, goal?, question?, image?: {mimeType, data} }` | `{ answer, citations, toolTrace, steps }` |

Legacy single-purpose routes (`/pageSummarize`, `/customizedReq`,
`/sentenceExplain`, `/highlightSentence`) remain available.

## Local development

### Backend
​```bash
cd server
cp .env.example .env          # set GEMINI_KEY and MONGO_URI
npm install
RAG_STORE=memory npm run start-server   # or RAG_STORE=atlas with a vector index
​```
For the Atlas vector store, create the index from
[docs/atlas-vector-index.json](docs/atlas-vector-index.json) on the `chunks`
collection. `RAG_MIN_SCORE` (default `0.4`) tunes the retrieval relevance floor.

### Extension
​```bash
npm install
npm start                     # dev build with hot reload
​```
Load the `build/` directory as an unpacked extension in Chrome.

### Tests
​```bash
cd server && npx jest         # backend unit tests (no network/key/Atlas needed)
​```

## Status

- ✅ RAG retrieval core + grounded generation with citations
- ✅ Bounded Gemini function-calling agent with a tool trace
- ✅ Multimodal vision tool (`analyzeImage`)
- 🚧 Extension Panel/Background wiring for ingest + agent + highlight rendering

## Acknowledgements

Created from boilerplate https://github.com/lxieyang/chrome-extension-boilerplate-react
```

(Again: render the three ` ​``` ` fences as plain triple-backticks in the real file.)

- [ ] **Step 3: Verify Markdown is well-formed**

Run: `cd /Users/xinyangwu/projects/AIReadingPartner && node -e "const fs=require('fs'); for (const f of ['README.md','docs/architecture.md']) { const t=fs.readFileSync(f,'utf8'); const fences=(t.match(/```/g)||[]).length; if (fences % 2 !== 0) throw new Error(f+': unbalanced code fences ('+fences+')'); if (/​/.test(t)) throw new Error(f+': contains zero-width space'); } console.log('docs ok');"`
Expected: prints `docs ok` (balanced code fences, no stray zero-width characters). If it throws, fix the offending fences and re-run.

- [ ] **Step 4: Confirm the linked files exist**

Run: `cd /Users/xinyangwu/projects/AIReadingPartner && ls docs/architecture.md docs/atlas-vector-index.json`
Expected: both paths listed (the README links resolve).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: reference-app README + architecture diagram"
```

---

### Task 4: Manual end-to-end smoke test (real Gemini vision)

**Files:** none (verification only). Requires a valid `GEMINI_KEY` in `server/.env` and a small base64 PNG.

- [ ] **Step 1: Start the server**

Run: `cd server && RAG_STORE=memory npm run start-server`
Expected: `Express server running...`.

- [ ] **Step 2: Run the agent with an attached image**

Prepare a base64 image (e.g. `IMG=$(base64 -i some-chart.png | tr -d '\n')`), then:
```bash
curl -s -X POST http://localhost:3030/api/task/agent \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"1\",\"url\":\"http://demo\",\"question\":\"What does this image show?\",\"image\":{\"mimeType\":\"image/png\",\"data\":\"$IMG\"}}"
```
Expected: JSON where `toolTrace` contains an `analyzeImage` call with `result.source === 'vision'`, and `answer` describes the image. `citations` is `[]` for a pure-vision answer.

- [ ] **Step 3: Confirm malformed image is rejected**

Run the same call with `"image":{"mimeType":"image/png"}` (no `data`).
Expected: HTTP 400 with the "Invalid image" message.

- [ ] **Step 4: Stop the server** (Ctrl-C). No commit (verification only).

---

## Self-Review

**Spec coverage (Phase 3 = "multimodal + docs"):**
- Multimodal `analyzeImage` tool (screenshot → Gemini vision), invoked inside the same agent loop → Tasks 1–2. ✓
- Vision answers flagged `source: 'vision'`, not chunk-cited → Task 1 (`{result, source:'vision'}`, no citations) + Task 2 test asserts `citations: []`. ✓
- Image payload validated; server already allows 50mb JSON → Task 2 (`isValidImage`). ✓
- README + architecture diagram → Task 3. ✓
- Extension Panel/Background wiring explicitly deferred to Phase 4 (needs a browser) — stated in scope. Intentional.
- Tests run without network/Atlas/key; Task 4 is the only network test. ✓

**Type/interface consistency:**
- `createTools({...image, analyzeImageFn})` extended signature used identically by tools tests (Task 1) and the controller (Task 2). ✓
- `analyzeImageFn(prompt, image) → string` signature consistent between `defaultAnalyzeImage` (Task 2), the injected `ragAnalyzeImage` test fake, and the handler call in `tools.js` (Task 1). ✓
- Handler result `{result, source:'vision'}` carries no `citations`/`indices`, so the orchestrator's `addCitations` leaves citations untouched — matches the Task 2 assertion `citations: []`. ✓
- `req.app.locals` keys (`ragStore`, `ragEmbed`, `ragGenerate`, `ragAnalyzeImage`, `agentChat`) consistent between controller and tests. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the doc tasks include the full file contents and a verification command. The only non-literal note is the Mermaid/code-fence rendering caveat, which is explicit. ✓
