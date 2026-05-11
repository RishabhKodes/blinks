import { NextResponse } from "next/server";

// GET /api/settings -- return current config (no secrets)
export async function GET() {
  return NextResponse.json({
    provider: process.env.LLM_PROVIDER || "openai",
    claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    openaiModel: process.env.OPENAI_MODEL || "gpt-5.5",
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenaiKey: !!process.env.OPENAI_API_KEY,
    storagePath: "d1://blinks-db",
  });
}
