# Blinks

Blinks is a local-first knowledge graph for saved resources.

You add URLs, Blinks extracts the content, classifies it with an LLM, stores it in SQLite, and visualizes relationships in an interactive graph with chat over your own knowledge base.

## What You Get

- URL ingestion pipeline with extraction + enrichment (`/api/ingest`)
- LLM-generated summaries, topics, and topic relationships
- Interactive graph UI of saved resources
- Topic compilation endpoint for wiki-style synthesis (`/api/compile`)
- Grounded chat over your saved data (`/api/chat`)
- Local markdown vault export in `blinks-vault/`
- Web Share Target support (`/share`) for mobile quick-save flows

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- SQLite (`better-sqlite3`) + Drizzle ORM
- OpenAI / Anthropic provider support

## Local Setup

### 1) Prerequisites

- Node.js 20+
- npm 10+
- One model provider key:
  - OpenAI API key, or
  - Anthropic API key

### 2) Install

```bash
npm install
```

### 3) Configure environment

```bash
cp .env.example .env
```

Then edit `.env` with your provider credentials.

### 4) Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

`LLM_PROVIDER`
- `openai` (default) or `claude`

`OPENAI_API_KEY`
- Required when `LLM_PROVIDER=openai`

`OPENAI_MODEL`
- Default: `gpt-5.5`

`OPENAI_JSON_FALLBACK_MODEL`
- Optional
- Used for structured classification fallback
- Default: `gpt-5.4-mini`

`ANTHROPIC_API_KEY`
- Required when `LLM_PROVIDER=claude`

`CLAUDE_MODEL`
- Optional
- Default: `claude-sonnet-4-20250514`

`CLAUDE_JSON_FALLBACK_MODEL`
- Optional fallback for classification JSON parsing

## First-Run Checklist

1. Start dev server with `npm run dev`.
2. Add one URL from the `+ Add` flow.
3. Confirm it appears in the graph.
4. Open `/settings` and verify provider/key status.
5. Ask a question in chat to confirm LLM connectivity.

## Local Data and Reset

All generated local data is stored in `blinks-vault/`:

- `blinks-vault/blinks.db` (SQLite)
- `blinks-vault/topics/**` (markdown resources/topics)
- `blinks-vault/_index.md` and `blinks-vault/_graph.json`

The folder is gitignored.

To reset local data, stop the dev server and remove `blinks-vault/`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Troubleshooting

- `OPENAI_API_KEY is required...` or `ANTHROPIC_API_KEY is required...`
  - Check `.env` and restart the dev server.
- Build works but ingestion fails
  - Check outbound network access for source URLs and provider API access.
- Empty graph
  - Add at least one resource using the `+ Add` action.

## Open Source Notes

- Never commit real credentials.
- `.env*` is ignored except `.env.example`.
- This project is intended for self-hosted/local usage.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT - see [LICENSE](./LICENSE).
