# AI Reading Partner → RAG-shaped Reference Application — Design

**Date:** 2026-06-19
**Status:** Approved design, pending implementation plan(s)

## Goal

Reshape AI Reading Partner into a compact, **interview-defensible** RAG-shaped reference
application that demonstrates end-to-end GenAI product delivery:

> A multimodal agentic Chrome extension powered by the Gemini API — DOM extraction,
> backend orchestration, and live UI — a compact RAG-shaped reference application
> demonstrating end-to-end GenAI product delivery.

Every word in that pitch must be defensible:

- **RAG** — generation is grounded on *retrieved* chunks (embeddings + top-k vector
  search), not whole-page prompt-stuffing, and answers carry citations to source chunks.
- **multimodal** — the agent can take a page screenshot/image and reason over it via
  Gemini vision, inside the same loop.
- **agentic** — a bounded Gemini function-calling loop that plans → calls tools →
  observes → decides, rather than one-shot prompts.

## Starting point (what exists today)

- **Chrome extension** (React + TS, webpack boilerplate): Background / Content / Panel /
  Popup / Options pages. Content scripts do real DOM extraction
  (`src/pages/Content/modules/extract-structured-text.js`) producing indexed blocks
  `{index, content}`, plus highlight/clear-highlight.
- **Express + MongoDB backend** with 4 Gemini endpoints — `pageSummarize`,
  `customizedReq` (multi-turn chat w/ stored history), `sentenceExplain`,
  `highlightSentence` — each stuffs the *entire* page text into a Gemini prompt
  (`@google/generative-ai`, gemini-1.5-flash / flash-8b). Mongo stores `geminiReq`
  records and `reqHistory`.

**The gap:** no retrieval, text-only, no agent loop. This design closes all three.

## Chosen approach

**Single agentic orchestrator with RAG-as-a-tool.** One `/api/agent` endpoint runs a
Gemini function-calling loop. Tools = `retrieve` (RAG core), `summarize`,
`explainSentence`, `highlightRelevant`, `analyzeImage` (multimodal). The existing four
controllers are refactored into these tool functions — same Gemini calls, but fed
*retrieved* context instead of the whole page, and reused by the agent. Thin legacy
routes are kept so nothing breaks; the agent is the new front door and **decides** which
tools to call.

Rejected: a thin deterministic router (under-delivers on "agentic"); multi-agent
planner/retriever/writer (overkill for "compact").

## Architecture & data flow

```
┌─────────────────────── Chrome Extension ───────────────────────┐
│  Content script: extract-structured-text  →  indexed DOM blocks │
│  Panel (React UI): goal + question + "analyze visual" + image    │
│        │ 1. POST /api/ingest (blocks)      │ 3. POST /api/agent  │
└────────┼───────────────────────────────────┼───────────────────┘
         ▼                                    ▼
┌──────────────── Express backend (orchestration) ────────────────┐
│  ingest()            agent loop (Gemini function-calling)        │
│   chunk → embed       plan → call tool → observe → decide        │
│   (text-embedding-    ┌──────────── tools ───────────┐           │
│    004) → upsert      │ retrieve(q)  ← RAG core       │           │
│                       │ summarize / explain /         │           │
│                       │ highlightRelevant             │           │
│                       │ analyzeImage  ← multimodal    │           │
│                       └───────────────────────────────┘          │
│  retrieve(q): embed query → $vectorSearch top-k → grounded       │
│               context + source indices (citations)               │
└─────────┬───────────────────────────────────────────────────────┘
          ▼
┌──────────── MongoDB Atlas ────────────┐
│  chunks (content + embedding + vec idx)│   geminiReq / reqHistory (kept)
└────────────────────────────────────────┘
```

1. Panel sends extracted DOM blocks to `/api/ingest`; server chunks + embeds + upserts
   into an Atlas `chunks` collection with a vector index.
2. User sets a goal / asks a question (optionally with a screenshot).
3. `/api/agent` runs the function-calling loop; the agent calls `retrieve` to pull only
   top-k relevant chunks, optionally `analyzeImage`, then produces a grounded answer
   **with citations to source chunk indices**, which the UI uses to drive highlighting.

## Component design

### Retrieval core — `server/rag/`

- **`embeddings.js`** — `embed(texts: string[]) → number[][]`. Wraps Gemini
  `text-embedding-004` (768-dim). Batches, retries on rate-limit. Single place that
  knows the embedding model.
- **`chunker.js`** — `chunk(blocks) → {index, content}[]`. Reuses the content script's
  indexed DOM blocks as natural chunks, merging tiny adjacent blocks up to ~500 chars.
  Preserves original `index` so citations map back to on-page highlighting.
- **`store.js`** — swappable backend behind one interface:
  - `upsert(userId, url, chunks)` → embed + write to Atlas `chunks`.
  - `retrieve(userId, url, query, k=5)` → embed query → `$vectorSearch` (filtered by
    `userId`+`url`) → `[{index, content, score}]`.
  - **In-memory cosine fallback** is a drop-in if no Atlas vector index is available;
    the agent never knows which backend is used.
- **Grounding contract:** `retrieve` returns chunks with source indices + scores. The
  generation prompt is `"Answer using ONLY the numbered context below; cite the indices
  you used."` Unsupported questions return "not found in page", not a hallucination,
  when all top-k scores are below a floor.

### Agent orchestrator — `server/agent/`

- **`orchestrator.js`** — `POST /api/agent`, input `{ userId, url, goal, question, image? }`:
  1. seed Gemini chat with system prompt + tool declarations
  2. send the user turn
  3. `while (step < MAX_STEPS=5)`: if response has a functionCall → run tool → feed
     functionResponse back; else final answer → break
  4. return `{ answer, citations[], toolTrace[], steps }`
  - Bounded by `MAX_STEPS` (no infinite loops). `toolTrace` logs every tool call + args
    + result for transparency and demo value.
- **`tools.js`** — each tool is a plain async fn + a Gemini `functionDeclaration` schema:

  | tool | purpose | grounding |
  |---|---|---|
  | `retrieve(query, k)` | RAG core — top-k chunks | `{index, content, score}[]` |
  | `summarize(goal)` | retrieve then summarize retrieved context | cites indices |
  | `explainSentence(sentence)` | retrieve neighbors, explain in context | cites indices |
  | `highlightRelevant(goal)` | retrieve, return chunk indices to highlight | indices → UI highlight |
  | `analyzeImage(prompt)` | multimodal — send screenshot to Gemini vision | vision-sourced (flagged) |

- The four legacy controllers become these tool functions. System prompt centralizes
  the relevance/safety check currently done ad-hoc (the `"no"` responses).

### Multimodal vision path

- **Capture:** Panel "Analyze visual" action → Background `chrome.tabs.captureVisibleTab`
  → base64 PNG (downscaled for latency). Confirm permissions against `manifest.json`;
  expected to need only `activeTab`/existing host perms.
- **Use:** `analyzeImage(prompt)` sends `[{inlineData:{mimeType,data}}, {text:prompt}]`
  to a vision-capable Gemini model. The agent invokes it for visual goals.
- **Honest framing:** image analysis is not chunk-retrievable, so its results are labeled
  vision-sourced in `toolTrace` rather than chunk-cited. Text answers are RAG-grounded;
  visual answers are vision-sourced and flagged as such.
- Server already sets `express.json({limit:'50mb'})`; downscale capture to keep latency
  reasonable.

### Ingestion lifecycle

- On Panel load / "Update", content script extracts indexed blocks → Panel
  `POST /api/ingest { userId, url, blocks }`.
- `ingest()` chunks → embeds → upserts. **Idempotent per `(userId, url)`**: re-ingest
  replaces prior chunks for that page. Returns `{ chunkCount }` for a "page indexed (N
  chunks)" UI state.

### Data model (Atlas)

- New collection **`chunks`**: `{ userId, url, index, content, embedding:[768], createdAt }`
  + a **vector search index** on `embedding` (cosine) with `userId`+`url` filter fields.
  Commit the index definition JSON for reproducibility.
- Keep `geminiReq` (now logs agent runs: goal, answer, citations, toolTrace, steps) and
  `reqHistory` (chat memory). `RequestData` appears unused — leave unless asked to remove.

## Error handling

- Embedding/generation failures: retry with backoff, then surface a clean error.
- Agent loop hard-capped at `MAX_STEPS`.
- Retrieval returns "no relevant content found" (not a hallucination) when all top-k
  scores are below a floor.
- Image path validates mime type and size.

## Testing

- Unit-test the retrieval core: chunker boundaries; cosine ranking via the in-memory
  backend (no network).
- Mocked-Gemini test of the agent loop: asserts `retrieve` is called before answering
  and that `MAX_STEPS` is respected.
- These run without Atlas or a real API key.

## Reference-app deliverables

- Rewrite `README.md`: the one-paragraph pitch, an architecture diagram (SVG), a "how RAG
  works here" section, request/response contracts, local-run guide.
- `docs/architecture.md`: data-flow + the three honest claims (RAG-grounded text,
  vision-sourced images, bounded agent loop).
- `.env.example` + security pass: `server/.env` confirmed never committed and gitignored;
  added `*.key`/`*.crt`/`*.pem` to `.gitignore` (untracked `server.key`/`server.crt` at
  repo root). **(Done this session.)**

## Implementation phasing

Spec covers the whole reference app; implementation is phased (each phase verifiable):

- **Phase 1 — RAG foundation:** `server/rag/` (embeddings, chunker, store + in-memory
  fallback), `/api/ingest`, Atlas `chunks` collection + vector index, and refactoring
  generation to retrieve-then-generate with citations. Verifiable end-to-end without the
  agent loop or multimodal.
- **Phase 2 — Agent loop:** `server/agent/` orchestrator + tools, refactor legacy
  controllers into tools, `/api/agent`, keep legacy routes.
- **Phase 3 — Multimodal + docs/UI:** screenshot capture path, `analyzeImage` tool,
  Panel wiring for agent + citations/highlight, README/architecture docs + diagram.

## Non-goals (YAGNI)

- Multi-agent architectures.
- A dedicated vector DB service (Atlas is reused; in-memory is the only fallback).
- Cross-page / corpus-wide retrieval (retrieval is scoped per page via `userId`+`url`).
- Auth / multi-tenant hardening beyond the existing `userId` field.

## Open risks

- Atlas tier must support `$vectorSearch` (works on M0 free tier; in-memory fallback
  covers the gap otherwise).
- Screenshot latency/size — mitigated by downscaling.
- Gemini model/SDK version drift — model ids isolated in `embeddings.js` / `tools.js`.
