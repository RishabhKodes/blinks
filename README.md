# Blinks

Blinks is a local-first knowledge graph for saved resources.

You add URLs, Blinks extracts content, classifies it with an LLM, stores it in local Cloudflare D1 (SQLite), and visualizes relationships in an interactive graph with chat over your own saved data.

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Drizzle ORM + Cloudflare D1
- OpenAI or Anthropic LLM provider
- OpenNext + Wrangler for Cloudflare preview/deploy

## Quickstart (Local)

### 1) Prerequisites

- Node.js `22+` (Wrangler requires Node 22)
- npm `10+`
- One provider key:
  - OpenAI API key, or
  - Anthropic API key

### 2) Install dependencies

```bash
npm install
```

### 3) Configure app environment

```bash
cp .env.example .env
```

Edit `.env` and set your provider key.

### 4) Initialize local D1 schema

```bash
npm run db:migrate:local
```

This applies checked-in SQL migrations from `drizzle/` to your local D1 state.

### 5) Start app

```bash
npm run dev
```

Open `http://localhost:3000`.

## First-Run Sanity Check

1. Open `/settings` and confirm provider/key status.
2. Add one URL with `+ Add`.
3. Confirm it appears in the graph.
4. Ask one chat question to verify LLM connectivity.

## Environment Variables

`LLM_PROVIDER`
- `openai` (default) or `claude`

`OPENAI_API_KEY`
- Required when `LLM_PROVIDER=openai`

`OPENAI_MODEL`
- Optional
- Default: `gpt-5.5`

`OPENAI_JSON_FALLBACK_MODEL`
- Optional
- Default: `gpt-5.4-mini`

`ANTHROPIC_API_KEY`
- Required when `LLM_PROVIDER=claude`

`CLAUDE_MODEL`
- Optional
- Default: `claude-sonnet-4-20250514`

`CLAUDE_JSON_FALLBACK_MODEL`
- Optional fallback model for classification JSON parsing

## Local Data

Local D1 data is stored under `.wrangler/state/` (gitignored).

To reset local DB state:

```bash
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:init:local
npm run db:migrate:local
npm run build:worker
npm run preview
```

## Cloudflare Preview/Deploy (Optional)

For worker preview:

```bash
npm run preview
```

Wrangler will use values from `.env` by default. If you want separate preview-only values, copy `.dev.vars.example` to `.dev.vars`.

For deploys:

1. Update `wrangler.jsonc` with your real D1 `database_id`.
2. Set secrets with Wrangler (for example `wrangler secret put OPENAI_API_KEY`).
3. Run:

```bash
npm run deploy
```

## Troubleshooting

- `OPENAI_API_KEY is required...` or `ANTHROPIC_API_KEY is required...`
  - Check `.env`, then restart `npm run dev`.
- `no such table ...`
  - Run `npm run db:migrate:local`.
- `wrangler`/D1 commands fail on old Node versions
  - Upgrade to Node `22+`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT - see [LICENSE](./LICENSE).
