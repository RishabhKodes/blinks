import { NextResponse } from "next/server";
import path from "path";

// GET /api/settings -- return current config (no secrets)
export async function GET() {
  return NextResponse.json({
    provider: process.env.LLM_PROVIDER || "openai",
    claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenaiKey: !!process.env.OPENAI_API_KEY,
    vaultPath: path.join(process.cwd(), "blinks-vault"),
  });
}
