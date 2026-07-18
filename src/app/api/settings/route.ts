import { NextResponse } from "next/server";

async function checkOllamaReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// GET /api/settings -- return current config (no secrets)
export async function GET() {
  const provider = process.env.LLM_PROVIDER || "openai";
  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "");

  const isOllamaReachable = provider === "ollama"
    ? await checkOllamaReachable(ollamaBaseUrl)
    : false;

  return NextResponse.json({
    provider,
    claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    openaiModel: process.env.OPENAI_MODEL || "gpt-5.5",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
    ollamaBaseUrl,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenaiKey: !!process.env.OPENAI_API_KEY,
    isOllamaReachable,
    storagePath: "d1://blinks-db",
  });
}
