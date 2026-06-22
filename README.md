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
```bash
cd server
cp .env.example .env          # set GEMINI_KEY and MONGO_URI
npm install
RAG_STORE=memory npm run start-server   # or RAG_STORE=atlas with a vector index
```
For the Atlas vector store, create the index from
[docs/atlas-vector-index.json](docs/atlas-vector-index.json) on the `chunks`
collection. `RAG_MIN_SCORE` (default `0.4`) tunes the retrieval relevance floor.

### Extension
```bash
npm install
npm start                     # dev build with hot reload
```
Load the `build/` directory as an unpacked extension in Chrome.

### Tests
```bash
cd server && npx jest         # backend unit tests (no network/key/Atlas needed)
```

## Status

- ✅ RAG retrieval core + grounded generation with citations
- ✅ Bounded Gemini function-calling agent with a tool trace
- ✅ Multimodal vision tool (`analyzeImage`)
- 🚧 Extension Panel/Background wiring for ingest + agent + highlight rendering

## Acknowledgements

Created from boilerplate https://github.com/lxieyang/chrome-extension-boilerplate-react
