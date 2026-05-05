# Contributing to Blinks

Thanks for contributing. This guide is for local contributors and external PRs.

## Ways to Contribute

- Bug fixes
- UX improvements
- Documentation updates
- Performance or reliability improvements
- Test coverage and tooling improvements

## Local Development Setup

1. Install dependencies:
   - `npm install`
2. Copy env template:
   - `cp .env.example .env`
3. Set your provider key in `.env`.
4. Start the app:
   - `npm run dev`

## Project Structure (High-Level)

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - client UI components
- `src/lib/content/` - URL content extraction/fetching
- `src/lib/llm/` - provider integrations + classification/compile/chat helpers
- `src/lib/db/` - Drizzle schema and SQLite setup
- `blinks-vault/` - local generated database/markdown artifacts (gitignored)

## Contribution Guidelines

- Keep PRs focused and small when possible.
- Prefer clear, maintainable TypeScript over clever abstractions.
- Avoid adding dependencies unless they are necessary and justified.
- Do not commit local vault data, secrets, or `.env` files.
- If behavior changes, update docs (`README.md` and/or inline comments).

## Quality Checks Before PR

Run these locally:

```bash
npm run lint
npm run build
```

Warnings are acceptable when unrelated to your change, but new warnings introduced by your PR should be fixed.

## Pull Request Expectations

Please include:

- Problem statement
- What changed
- Any API/behavior impacts
- Manual verification steps
- Screenshots or short recordings for UI changes

## Commit Hygiene

- Use descriptive commit messages.
- Separate refactors from behavior changes where possible.
- Keep generated files out of commits unless intentionally updated.

## Reporting Bugs

When filing an issue, include:

- Reproduction steps
- Expected vs actual behavior
- Logs/errors
- Environment details (OS, Node version, provider used)

## Security

For vulnerabilities, do not open a public issue. Follow [SECURITY.md](./SECURITY.md).
