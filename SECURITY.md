# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities in public issues.

Use GitHub's private vulnerability reporting (Security Advisories) for this repository. Include:

- A clear description of the issue
- Reproduction steps
- Impact assessment
- Any suggested remediation

## Response Expectations

- We will acknowledge reports as quickly as possible.
- We will validate and triage based on severity and exploitability.
- Fixes will be released with public notes after remediation.

## Scope

This project is primarily self-hosted/local-first. Sensitive areas include:

- API routes under `src/app/api/**`
- LLM provider integrations and environment-variable handling
- File and database persistence under `blinks-vault/`
