# Blinks

A local-first knowledge graph for your saved resources. Add URLs, and Blinks extracts the content, classifies it with an LLM, discovers connections between resources, and visualizes everything as an interactive graph you can explore and chat with.

> **Bring Your Own Key** -- Blinks does not include or ship any LLM API keys.
> You supply your own OpenAI, Anthropic, or Ollama setup. All LLM calls run
> against your key, on your account. Nothing is proxied.

## Features

- **Save and classify** -- paste a URL and Blinks fetches the content, generates a title, summary, key concepts, and topic tags via LLM
- **Knowledge graph** -- resources and topics render as an interactive force-directed graph with drag, zoom, and click-to-inspect
- **Semantic connections** -- a second LLM pass finds relationships between resources (same subject, builds on, contrasts, applies, source reference)
- **Chat** -- ask questions about your saved resources; the LLM answers using only your knowledge base
- **Obsidian vault export** -- every resource and topic is written as a Markdown file with `[[wiki-links]]`, compatible with Obsidian
- **PWA** -- installable on mobile with share-target support (share URLs directly from other apps)
- **Three LLM providers** -- OpenAI (cloud), Anthropic/Claude (cloud), or Ollama (local, fully offline)

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Drizzle ORM + Cloudflare D1 (SQLite)
- OpenAI, Anthropic, or Ollama for LLM
- OpenNext + Wrangler for Cloudflare preview/deploy

## Quickstart

### 1) Prerequisites

- Node.js `22+`
- npm `10+`
- One of:
  - [OpenAI API key](https://platform.openai.com/api-keys) (default provider)
  - [Anthropic API key](https://console.anthropic.com/settings/keys)
  - [Ollama](https://ollama.com) installed locally (no API key needed)

### 2) Install dependencies

```bash
npm install
```

### 3) Configure your LLM provider

```bash
cp .env.example .env
```

Open `.env` and set your provider and key:

```bash
# Option A: OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Option B: Anthropic
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=sk-ant-...

# Option C: Ollama (local, no key needed)
# LLM_PROVIDER=ollama
# OLLAMA_MODEL=llama3.2
```

### 4) Initialize local database

```bash
npm run db:migrate:local
```

This applies the SQL migrations from `drizzle/` to your local D1 SQLite database.

### 5) Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### First-run check

1. Open `/settings` and confirm your provider and key status.
2. Add one URL with **+ Add**.
3. Confirm it appears in the graph.
4. Ask a chat question to verify LLM connectivity.

## Using Ollama (Local Models)

Ollama lets you run LLMs locally with no cloud API key. Blinks talks to Ollama via its OpenAI-compatible API.

### Setup

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model:

```bash
ollama pull llama3.2
```

3. Start the Ollama server (if not already running):

```bash
ollama serve
```

4. Set your `.env`:

```bash
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
# OLLAMA_BASE_URL=http://localhost:11434   # default, change if needed
```

5. Start Blinks: `npm run dev`

### Recommended models

Blinks needs models that follow JSON instructions reliably. Good options:

| Model | Size | Notes |
|-------|------|-------|
| `llama3.2` | 3B | Fast, good JSON output |
| `llama3.2:latest` | 3B | Same as above |
| `mistral` | 7B | Strong instruction following |
| `qwen2.5` | 7B | Good multilingual + JSON support |
| `llama3.3` | 70B | Best quality, needs more RAM |

Blinks has built-in JSON repair for malformed LLM output, so even smaller models work reasonably well.

## Mobile Access

The Blinks UI is fully responsive -- the graph, panels, modals, and chat all adapt to small screens.

### Browser access (works immediately)

Next.js 16 binds to all network interfaces by default, so `npm run dev` is already reachable from any device on the same WiFi.

1. Find your local IP:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows
ipconfig | findstr IPv4
```

2. On your phone, open `http://<your-ip>:3000`

That is all you need. The full app works in the mobile browser -- browse the graph, add URLs, chat, search.

**Tip:** Set `AUTH_USERNAME` and `AUTH_PASSWORD` in `.env` to protect access if you are on a shared network.

### Install as app (requires HTTPS)

For the full PWA experience (standalone app window, "Blinks" in the system share sheet), you need HTTPS. Over plain HTTP the app works fine in the browser, but the service worker and install prompt are unavailable.

**Quick HTTPS with Cloudflare Tunnel** (free, no account for quick tunnels):

```bash
# Install: brew install cloudflared (macOS) or see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

This gives you a temporary `https://....trycloudflare.com` URL.

**Then install on your device:**

- **iOS**: Open the HTTPS URL in Safari, tap Share, then **Add to Home Screen**
- **Android**: Open in Chrome, tap the menu, then **Install App** or **Add to Home Screen**

Once installed, Blinks opens as a standalone fullscreen app. The system share sheet includes "Blinks" as a target -- share any URL from your browser or other apps and it auto-saves to your knowledge graph.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_PROVIDER` | No | `openai` | `openai`, `claude`, or `ollama` |
| `OPENAI_API_KEY` | When provider is `openai` | -- | Your OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-5.5` | Model for chat and general use |
| `OPENAI_CLASSIFICATION_MODEL` | No | `gpt-5-mini` | Model for resource classification |
| `OPENAI_CONNECTION_MODEL` | No | `gpt-5.4-mini` | Model for connection discovery |
| `OPENAI_JSON_FALLBACK_MODEL` | No | `gpt-5.4-mini` | Fallback for classification retries |
| `ANTHROPIC_API_KEY` | When provider is `claude` | -- | Your Anthropic API key |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Model for all Claude tasks |
| `CLAUDE_CLASSIFICATION_MODEL` | No | Same as `CLAUDE_MODEL` | Override for classification |
| `CLAUDE_CONNECTION_MODEL` | No | Same as `CLAUDE_MODEL` | Override for connections |
| `CLAUDE_JSON_FALLBACK_MODEL` | No | `claude-sonnet-4-20250514` | Fallback for classification retries |
| `OLLAMA_MODEL` | No | `llama3.2` | Ollama model name (used for all tasks) |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server address |
| `AUTH_USERNAME` | No | -- | Set with `AUTH_PASSWORD` to enable login wall |
| `AUTH_PASSWORD` | No | -- | Set with `AUTH_USERNAME` to enable login wall |

## Local Data

Local D1 data is stored under `.wrangler/state/` (gitignored).

To reset the local database:

```bash
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint
npm run db:migrate:local # Apply DB migrations locally
npm run preview          # Cloudflare worker preview
npm run deploy           # Build and deploy to Cloudflare
```

## Cloudflare Deploy (Optional)

For a permanent deployment with HTTPS (also enables full PWA on mobile):

1. Update `wrangler.jsonc` with your D1 `database_id`.
2. Set secrets: `wrangler secret put OPENAI_API_KEY` (or whichever provider you use).
3. Run:

```bash
npm run deploy
```

## Troubleshooting

**`OPENAI_API_KEY is required...` or `ANTHROPIC_API_KEY is required...`**
Check `.env`, then restart `npm run dev`.

**`no such table ...`**
Run `npm run db:migrate:local`.

**Ollama: classification fails or returns empty results**
- Make sure `ollama serve` is running
- Verify the model is pulled: `ollama list`
- Try a larger model (`mistral` or `qwen2.5`) if JSON output is consistently malformed
- Check `OLLAMA_BASE_URL` if Ollama runs on a non-default port

**Mobile: can't reach the app from phone**
- Confirm phone and computer are on the same WiFi network
- Check your firewall allows connections on port 3000
- Try `http://<ip>:3000` (not `https`)

**Mobile: "Install App" option not available**
- PWA install requires HTTPS. Use `cloudflared tunnel` or deploy to Cloudflare (see sections above)

**Wrangler/D1 commands fail**
Upgrade to Node `22+`.

## Roadmap

- [ ] Provider selection from the Settings UI (no restart required)
- [ ] Support for more providers (Gemini, Groq, Mistral API)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT -- see [LICENSE](./LICENSE).
