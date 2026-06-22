# Architecture

AI Reading Partner is a RAG-shaped reference application: a Chrome extension that
extracts the page you're reading, and a Gemini-powered backend that retrieves the
most relevant passages and answers — grounded, with citations — through a bounded
agent loop.

## Data flow

```mermaid
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
```

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
