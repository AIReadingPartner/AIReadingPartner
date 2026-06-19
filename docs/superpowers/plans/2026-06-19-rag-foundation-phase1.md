# RAG Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace whole-page prompt-stuffing with a real retrieve-then-generate pipeline — chunk extracted DOM blocks, embed them with Gemini, store/retrieve top-k by vector similarity, and generate answers grounded on retrieved chunks with citations.

**Architecture:** A self-contained `server/rag/` module (cosine, chunker, embeddings, two swappable stores, and an `index.js` facade) plus an `/api/ingest` endpoint and a retrieval-grounded refactor of `pageSummarize`. The store backend is chosen by env (`RAG_STORE=memory|atlas`) behind one interface, so the in-memory cosine backend is a drop-in when Atlas vector search is unavailable. The agent loop and multimodal path are out of scope (Phases 2–3).

**Tech Stack:** Node.js, Express, MongoDB/Mongoose (Atlas `$vectorSearch`), `@google/generative-ai` (`text-embedding-004`, `gemini-1.5-flash`), Jest.

---

## File Structure

- Create `server/rag/cosine.js` — pure cosine-similarity helper (no deps).
- Create `server/rag/chunker.js` — merge indexed DOM blocks into ~500-char chunks, preserving source `index`.
- Create `server/rag/embeddings.js` — `createEmbedder(model)` wrapping Gemini `text-embedding-004`; injectable model for tests.
- Create `server/rag/memoryStore.js` — in-memory `{upsert, retrieve}` using cosine.
- Create `server/rag/atlasStore.js` — Mongo `$vectorSearch`-backed `{upsert, retrieve}`.
- Create `server/rag/index.js` — `getStore()` selector + `retrieveContext()` facade (embed query → retrieve → format grounded context + citations).
- Create `server/models/Chunk.js` — Mongoose model for the `chunks` collection.
- Create `server/controllers/ingest.js` — `ingest()` controller.
- Modify `server/routes/taskRoutes.js` — add `POST /ingest`.
- Modify `server/controllers/pageSummary.js` — retrieve-then-generate with citations.
- Create `server/rag/__tests__/*.test.js` — unit tests (no network, no Atlas).
- Create `server/jest.config.js`, modify `server/package.json` — Jest setup.
- Create `docs/atlas-vector-index.json` — committed vector index definition.

Conventions to follow (match existing code): CommonJS (`require`/`module.exports`), 2-space indent, controllers export `exports.fn = async (req,res) => {...}` and return `res.status(400).json({message})` on missing fields.

---

### Task 1: Add Jest test infrastructure to the server

**Files:**
- Modify: `server/package.json`
- Create: `server/jest.config.js`

- [ ] **Step 1: Add Jest config**

Create `server/jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
};
```

- [ ] **Step 2: Add the dev dependency and test script**

Edit `server/package.json` — add `"test": "jest"` to `scripts` (replace the placeholder test script) and add Jest to a new `devDependencies` block:

```json
  "scripts": {
    "test": "jest",
    "start-server": "nodemon server.js"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  },
```

- [ ] **Step 3: Install**

Run: `cd server && npm install`
Expected: completes; `node_modules/.bin/jest` exists.

- [ ] **Step 4: Verify Jest runs (no tests yet)**

Run: `cd server && npx jest --passWithNoTests`
Expected: `No tests found, exiting with code 0` (passWithNoTests) — exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/jest.config.js
git commit -m "test: add Jest to server"
```

---

### Task 2: Cosine similarity helper

**Files:**
- Create: `server/rag/cosine.js`
- Test: `server/rag/__tests__/cosine.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/cosine.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest cosine`
Expected: FAIL — "Cannot find module '../cosine'".

- [ ] **Step 3: Write minimal implementation**

Create `server/rag/cosine.js`:

```js
// Cosine similarity between two equal-length numeric vectors.
const cosine = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

module.exports = { cosine };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest cosine`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/rag/cosine.js server/rag/__tests__/cosine.test.js
git commit -m "feat: add cosine similarity helper for RAG"
```

---

### Task 3: DOM-block chunker

**Files:**
- Create: `server/rag/chunker.js`
- Test: `server/rag/__tests__/chunker.test.js`

Input blocks come from the content script as `{tag, content, id, className, index}`. The chunker only needs `index` + `content`. It merges consecutive blocks until adding the next would exceed `maxChars`, keeping the **first** block's `index` as the chunk's citation anchor.

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/chunker.test.js`:

```js
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
  // 'aaa\nbbb' = 7 chars (<=8), adding 'ccc' -> 11 (>8) starts a new chunk
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest chunker`
Expected: FAIL — "Cannot find module '../chunker'".

- [ ] **Step 3: Write minimal implementation**

Create `server/rag/chunker.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest chunker`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/rag/chunker.js server/rag/__tests__/chunker.test.js
git commit -m "feat: add DOM-block chunker for RAG"
```

---

### Task 4: Gemini embedder (injectable)

**Files:**
- Create: `server/rag/embeddings.js`
- Test: `server/rag/__tests__/embeddings.test.js`

`createEmbedder(model)` takes any object with `batchEmbedContents(...)` so tests inject a fake. A default `embed` is wired to Gemini `text-embedding-004` lazily (only when a real key exists).

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/embeddings.test.js`:

```js
const { createEmbedder } = require('../embeddings');

test('embeds a batch of texts into vectors', async () => {
  const fakeModel = {
    batchEmbedContents: jest.fn().mockResolvedValue({
      embeddings: [{ values: [1, 2, 3] }, { values: [4, 5, 6] }],
    }),
  };
  const embed = createEmbedder(fakeModel);
  const vectors = await embed(['a', 'b']);

  expect(vectors).toEqual([[1, 2, 3], [4, 5, 6]]);
  expect(fakeModel.batchEmbedContents).toHaveBeenCalledWith({
    requests: [
      { content: { parts: [{ text: 'a' }] } },
      { content: { parts: [{ text: 'b' }] } },
    ],
  });
});

test('returns [] for empty input without calling the model', async () => {
  const fakeModel = { batchEmbedContents: jest.fn() };
  const embed = createEmbedder(fakeModel);
  expect(await embed([])).toEqual([]);
  expect(fakeModel.batchEmbedContents).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest embeddings`
Expected: FAIL — "Cannot find module '../embeddings'".

- [ ] **Step 3: Write minimal implementation**

Create `server/rag/embeddings.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest embeddings`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/rag/embeddings.js server/rag/__tests__/embeddings.test.js
git commit -m "feat: add Gemini text-embedding-004 embedder"
```

---

### Task 5: In-memory store

**Files:**
- Create: `server/rag/memoryStore.js`
- Test: `server/rag/__tests__/memoryStore.test.js`

Interface (shared by both backends): `upsert(userId, url, chunks, embedVectors)` and `retrieve(userId, url, queryVector, k)`. The store does NOT embed — callers pass vectors in, so the store stays pure and testable.

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/memoryStore.test.js`:

```js
const { createMemoryStore } = require('../memoryStore');

test('upsert then retrieve returns top-k ranked by cosine, with index+score', async () => {
  const store = createMemoryStore();
  await store.upsert(
    'u1', 'http://x',
    [{ index: 0, content: 'apple' }, { index: 5, content: 'banana' }],
    [[1, 0], [0, 1]]
  );
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 1);

  expect(hits).toHaveLength(1);
  expect(hits[0].index).toBe(0);
  expect(hits[0].content).toBe('apple');
  expect(hits[0].score).toBeCloseTo(1, 6);
});

test('upsert replaces prior chunks for the same (userId,url)', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x', [{ index: 0, content: 'old' }], [[1, 0]]);
  await store.upsert('u1', 'http://x', [{ index: 0, content: 'new' }], [[1, 0]]);
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 5);

  expect(hits).toHaveLength(1);
  expect(hits[0].content).toBe('new');
});

test('retrieve isolates by userId and url', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x', [{ index: 0, content: 'mine' }], [[1, 0]]);
  await store.upsert('u2', 'http://x', [{ index: 0, content: 'theirs' }], [[1, 0]]);
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 5);

  expect(hits.map((h) => h.content)).toEqual(['mine']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest memoryStore`
Expected: FAIL — "Cannot find module '../memoryStore'".

- [ ] **Step 3: Write minimal implementation**

Create `server/rag/memoryStore.js`:

```js
const { cosine } = require('./cosine');

const key = (userId, url) => `${userId}::${url}`;

// In-memory cosine store. Records: { index, content, vector }.
const createMemoryStore = () => {
  const tables = new Map();

  return {
    async upsert(userId, url, chunks, vectors) {
      tables.set(
        key(userId, url),
        chunks.map((c, i) => ({ index: c.index, content: c.content, vector: vectors[i] }))
      );
    },

    async retrieve(userId, url, queryVector, k = 5) {
      const rows = tables.get(key(userId, url)) || [];
      return rows
        .map((r) => ({ index: r.index, content: r.content, score: cosine(queryVector, r.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },
  };
};

module.exports = { createMemoryStore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest memoryStore`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/rag/memoryStore.js server/rag/__tests__/memoryStore.test.js
git commit -m "feat: add in-memory cosine vector store"
```

---

### Task 6: Chunk Mongoose model + Atlas store

**Files:**
- Create: `server/models/Chunk.js`
- Create: `server/rag/atlasStore.js`
- Create: `docs/atlas-vector-index.json`

The Atlas store mirrors the memory-store interface and uses `$vectorSearch`. It is exercised against real Atlas in Task 9's manual smoke test (not unit-tested, since it needs a live cluster). Keep the interface identical so the facade can swap backends.

- [ ] **Step 1: Create the Chunk model**

Create `server/models/Chunk.js`:

```js
const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  url: { type: String, required: true },
  index: { type: Number, required: true },   // source DOM block index (citation anchor)
  content: { type: String, required: true },
  embedding: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now },
});

chunkSchema.index({ userId: 1, url: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
```

- [ ] **Step 2: Create the Atlas store**

Create `server/rag/atlasStore.js`:

```js
const Chunk = require('../models/Chunk');

// MongoDB Atlas $vectorSearch backend. Same interface as the memory store.
const createAtlasStore = () => ({
  async upsert(userId, url, chunks, vectors) {
    await Chunk.deleteMany({ userId, url }); // idempotent per (userId,url)
    await Chunk.insertMany(
      chunks.map((c, i) => ({ userId, url, index: c.index, content: c.content, embedding: vectors[i] }))
    );
  },

  async retrieve(userId, url, queryVector, k = 5) {
    const rows = await Chunk.aggregate([
      {
        $vectorSearch: {
          index: 'chunk_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(k * 20, 100),
          limit: k,
          filter: { userId, url },
        },
      },
      { $project: { _id: 0, index: 1, content: 1, score: { $meta: 'vectorSearchScore' } } },
    ]);
    return rows;
  },
});

module.exports = { createAtlasStore };
```

- [ ] **Step 3: Commit the vector index definition**

Create `docs/atlas-vector-index.json` (create this index named `chunk_vector_index` on the `chunks` collection via Atlas UI / API):

```json
{
  "name": "chunk_vector_index",
  "type": "vectorSearch",
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "url" }
  ]
}
```

- [ ] **Step 4: Sanity-check the files load**

Run: `cd server && node -e "require('./rag/atlasStore'); require('./models/Chunk'); console.log('ok')"`
Expected: prints `ok` (no syntax/require errors).

- [ ] **Step 5: Commit**

```bash
git add server/models/Chunk.js server/rag/atlasStore.js docs/atlas-vector-index.json
git commit -m "feat: add Chunk model + Atlas vector store + index def"
```

---

### Task 7: RAG facade (store selector + retrieveContext)

**Files:**
- Create: `server/rag/index.js`
- Test: `server/rag/__tests__/index.test.js`

The facade exposes `getStore()` (memory unless `RAG_STORE=atlas`) and `retrieveContext({ store, embed, userId, url, query, k })` which embeds the query, retrieves hits, and formats a grounded context string + citation indices. Both deps are injected for testing.

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/index.test.js`:

```js
const { retrieveContext, getStore } = require('../index');
const { createMemoryStore } = require('../memoryStore');

test('getStore returns memory store by default', () => {
  const prev = process.env.RAG_STORE;
  delete process.env.RAG_STORE;
  const store = getStore();
  expect(typeof store.retrieve).toBe('function');
  expect(typeof store.upsert).toBe('function');
  process.env.RAG_STORE = prev;
});

test('retrieveContext formats numbered context + citations from top hits', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 3, content: 'cats purr' }, { index: 7, content: 'dogs bark' }],
    [[1, 0], [0, 1]]);
  const embed = async () => [[1, 0]]; // query embeds near 'cats purr'

  const { context, citations, hits } = await retrieveContext({
    store, embed, userId: 'u1', url: 'http://x', query: 'what do cats do', k: 1,
  });

  expect(citations).toEqual([3]);
  expect(context).toContain('[3] cats purr');
  expect(hits[0].score).toBeCloseTo(1, 6);
});

test('retrieveContext returns empty when nothing indexed', async () => {
  const store = createMemoryStore();
  const embed = async () => [[1, 0]];
  const { context, citations } = await retrieveContext({
    store, embed, userId: 'u1', url: 'http://none', query: 'q', k: 5,
  });
  expect(citations).toEqual([]);
  expect(context).toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest rag/__tests__/index`
Expected: FAIL — "Cannot find module '../index'".

- [ ] **Step 3: Write minimal implementation**

Create `server/rag/index.js`:

```js
const { createMemoryStore } = require('./memoryStore');
const { createAtlasStore } = require('./atlasStore');
const { embed } = require('./embeddings');

let _memo = null;
// Memory store is a singleton so ingest + query within a process share state.
const getStore = () => {
  if (process.env.RAG_STORE === 'atlas') return createAtlasStore();
  if (!_memo) _memo = createMemoryStore();
  return _memo;
};

// Embed the query, retrieve top-k, and format grounded context + citation indices.
const retrieveContext = async ({ store, embed: embedFn = embed, userId, url, query, k = 5 }) => {
  const [queryVector] = await embedFn([query]);
  const hits = await store.retrieve(userId, url, queryVector, k);
  const context = hits.map((h) => `[${h.index}] ${h.content}`).join('\n');
  const citations = hits.map((h) => h.index);
  return { context, citations, hits };
};

module.exports = { getStore, retrieveContext };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest rag/__tests__/index`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/rag/index.js server/rag/__tests__/index.test.js
git commit -m "feat: add RAG facade (store selector + retrieveContext)"
```

---

### Task 8: `/api/ingest` endpoint

**Files:**
- Create: `server/controllers/ingest.js`
- Modify: `server/routes/taskRoutes.js`
- Test: `server/rag/__tests__/ingest.test.js`

The controller chunks blocks, embeds them, upserts, and returns `{ chunkCount }`. To keep it unit-testable, the embed + store deps default to the real ones but are read from `req.app.locals` when present (tests inject fakes).

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/ingest.test.js`:

```js
const { ingest } = require('../../controllers/ingest');
const { createMemoryStore } = require('../memoryStore');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('400 when blocks missing', async () => {
  const res = mockRes();
  await ingest({ body: { userId: 'u1', url: 'http://x' }, app: { locals: {} } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('chunks, embeds, upserts and returns chunkCount', async () => {
  const store = createMemoryStore();
  const embed = jest.fn(async (texts) => texts.map(() => [1, 0]));
  const req = {
    body: { userId: 'u1', url: 'http://x', blocks: [{ index: 0, content: 'hello world here' }] },
    app: { locals: { ragStore: store, ragEmbed: embed } },
  };
  const res = mockRes();
  await ingest(req, res);

  expect(embed).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ chunkCount: 1 }));
  const hits = await store.retrieve('u1', 'http://x', [1, 0], 5);
  expect(hits[0].content).toContain('hello world here');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest ingest`
Expected: FAIL — "Cannot find module '../../controllers/ingest'".

- [ ] **Step 3: Write minimal implementation**

Create `server/controllers/ingest.js`:

```js
const { chunk } = require('../rag/chunker');
const { getStore, retrieveContext } = require('../rag'); // retrieveContext re-export unused here
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
```

> Note: the `require('../rag')` line is only for the `getStore` default; if lint flags the unused `retrieveContext`, change to `const { getStore } = require('../rag');`.

- [ ] **Step 4: Wire the route**

Edit `server/routes/taskRoutes.js` — add near the other task routes:

```js
const ingestController = require('../controllers/ingest');
// ...
router.post('/ingest', ingestController.ingest);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest ingest`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/ingest.js server/routes/taskRoutes.js server/rag/__tests__/ingest.test.js
git commit -m "feat: add /api/task/ingest endpoint"
```

---

### Task 9: Retrieval-grounded `pageSummarize`

**Files:**
- Modify: `server/controllers/pageSummary.js`
- Test: `server/rag/__tests__/pageSummary.test.js`

Refactor `pageSummarize` to retrieve top-k chunks for the `browsingTarget` and summarize ONLY the retrieved context, returning `citations`. The Gemini generation call is injected via `req.app.locals.ragGenerate` so the test runs without network. When nothing is indexed for the page, return a clear "page not indexed" message instead of hallucinating.

- [ ] **Step 1: Write the failing test**

Create `server/rag/__tests__/pageSummary.test.js`:

```js
const { pageSummarize } = require('../../controllers/pageSummary');
const { createMemoryStore } = require('../memoryStore');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test('summarizes retrieved context and returns citations', async () => {
  const store = createMemoryStore();
  await store.upsert('u1', 'http://x',
    [{ index: 2, content: 'The river flooded the town.' }], [[1, 0]]);

  const req = {
    body: { userId: 'u1', type: 'summary', browsingTarget: 'flood', currentWebpage: 'http://x' },
    app: { locals: {
      ragStore: store,
      ragEmbed: async () => [[1, 0]],
      ragGenerate: async (prompt) => 'A flood hit the town.',
      ragSkipPersist: true, // skip Mongo save in unit test
    } },
  };
  const res = mockRes();
  await pageSummarize(req, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    citations: [2],
  }));
  const payload = res.json.mock.calls[0][0];
  expect(payload.data.result).toBe('A flood hit the town.');
});

test('returns not-indexed message when no chunks for the page', async () => {
  const store = createMemoryStore();
  const req = {
    body: { userId: 'u1', type: 'summary', browsingTarget: 'flood', currentWebpage: 'http://none' },
    app: { locals: { ragStore: store, ragEmbed: async () => [[1, 0]], ragGenerate: async () => 'x', ragSkipPersist: true } },
  };
  const res = mockRes();
  await pageSummarize(req, res);

  const payload = res.json.mock.calls[0][0];
  expect(payload.citations).toEqual([]);
  expect(payload.message).toMatch(/not indexed/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest rag/__tests__/pageSummary`
Expected: FAIL — `pageSummarize` does not yet read locals / return `citations`.

- [ ] **Step 3: Rewrite `pageSummarize`**

Replace the body of `exports.pageSummarize` in `server/controllers/pageSummary.js` (keep `saveSummary` and the existing `require`s; add the new requires at top):

```js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const GeminiReq = require('../models/geminiReq');
const { getStore, retrieveContext } = require('../rag');
const { embed: defaultEmbed } = require('../rag/embeddings');

const GEMINI_KEY = process.env.GEMINI_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Default generation: summarize using ONLY the retrieved, numbered context.
const defaultGenerate = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

exports.pageSummarize = async (req, res) => {
  try {
    const { userId, type, browsingTarget, currentWebpage } = req.body;
    if (!userId || !browsingTarget || !currentWebpage || !type) {
      return res.status(400).json({ message: 'Missing required fields in request body' });
    }

    const store = req.app.locals.ragStore || getStore();
    const embed = req.app.locals.ragEmbed || defaultEmbed;
    const generate = req.app.locals.ragGenerate || defaultGenerate;

    // currentWebpage carries the page URL (the ingestion key).
    const { context, citations } = await retrieveContext({
      store, embed, userId, url: currentWebpage, query: browsingTarget, k: 5,
    });

    if (!context) {
      return res.json({
        message: 'Page not indexed yet — call /api/task/ingest first',
        citations: [],
        data: null,
      });
    }

    const prompt = `Summarize the page for the goal "${browsingTarget}" in under 150 words. ` +
      `Use ONLY the numbered context below and cite the [n] indices you used. ` +
      `If the goal is irrelevant to the context, answer exactly "no".\n\nContext:\n${context}`;
    const responseText = await generate(prompt);
    const ifValid = !/^no(\s+)?$/i.test(responseText.trim());

    let data = { userId, type, browsingTarget, currentWebpage, result: responseText, ifValid };
    if (!req.app.locals.ragSkipPersist) {
      const geminiRequest = new GeminiReq(data);
      await geminiRequest.save();
      data = geminiRequest;
    }

    res.json({ message: 'Page summary processed', citations, data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error processing Page Summary', error: error.message });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest rag/__tests__/pageSummary`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd server && npx jest`
Expected: PASS — all suites (cosine, chunker, embeddings, memoryStore, index, ingest, pageSummary) green.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/pageSummary.js server/rag/__tests__/pageSummary.test.js
git commit -m "feat: ground pageSummarize on retrieved chunks with citations"
```

---

### Task 10: Manual end-to-end smoke test (memory store, real Gemini)

**Files:** none (verification only)

Confirms the pipeline works against the real Gemini embedding + generation APIs using the in-memory store (no Atlas needed). Requires a valid `GEMINI_KEY` in `server/.env`.

- [ ] **Step 1: Start the server**

Run: `cd server && RAG_STORE=memory npm run start-server`
Expected: logs `Express server running...` and `MongoDB connected successfully`.

- [ ] **Step 2: Ingest a page**

Run:
```bash
curl -s -X POST http://localhost:3030/api/task/ingest \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1","url":"http://demo","blocks":[{"index":0,"content":"The Eiffel Tower is in Paris and was completed in 1889."},{"index":1,"content":"It was the tallest structure in the world until 1930."}]}'
```
Expected: `{"message":"Page ingested","chunkCount":1}` (or 2).

- [ ] **Step 3: Summarize with retrieval**

Run:
```bash
curl -s -X POST http://localhost:3030/api/task/pageSummarize \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1","type":"summary","browsingTarget":"when was it built","currentWebpage":"http://demo"}'
```
Expected: JSON with a `citations` array (e.g. `[0]`) and `data.result` mentioning 1889.

- [ ] **Step 4: Confirm grounding rejects an unindexed page**

Run the same summarize call with `"currentWebpage":"http://not-indexed"`.
Expected: `{"message":"Page not indexed yet ...","citations":[],"data":null}`.

- [ ] **Step 5: Stop the server** (Ctrl-C). No commit (verification only).

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- RAG core `server/rag/` (embeddings, chunker, store + in-memory fallback) → Tasks 2–7. ✓
- `/api/ingest` → Task 8. ✓
- Atlas `chunks` collection + vector index → Task 6 (model + index def). ✓
- Retrieve-then-generate with citations → Task 9. ✓
- Tests run without Atlas or real key → Tasks 2–9 use injected fakes; Task 10 is the only network test. ✓
- Out of Phase 1 (deferred): agent loop (Phase 2), multimodal (Phase 3), refactor of the other three controllers (Phase 2, when they become agent tools). Noted intentionally.

**Type/interface consistency:**
- Store interface `upsert(userId,url,chunks,vectors)` / `retrieve(userId,url,queryVector,k)` is identical in `memoryStore.js` (Task 5) and `atlasStore.js` (Task 6). ✓
- `chunk(blocks,{maxChars})` returns `{index,content}` consumed by `retrieveContext` formatting `[index] content` and by the store. ✓
- `retrieveContext` returns `{context,citations,hits}`; consumed by `pageSummary.js` (uses `context`,`citations`) — names match. ✓
- `embed(texts) → vectors[][]` signature consistent across `embeddings.js`, store callers, and injected fakes. ✓
- `req.app.locals` injection keys (`ragStore`,`ragEmbed`,`ragGenerate`,`ragSkipPersist`) used identically in controllers and tests. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓
