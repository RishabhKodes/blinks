interface CloudflareEnv {
  DB: D1Database;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LLM_PROVIDER?: string;
      OPENAI_API_KEY?: string;
      OPENAI_MODEL?: string;
      OPENAI_JSON_FALLBACK_MODEL?: string;
      ANTHROPIC_API_KEY?: string;
      CLAUDE_MODEL?: string;
      CLAUDE_JSON_FALLBACK_MODEL?: string;
    }
  }
}
