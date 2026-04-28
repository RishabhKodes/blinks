type LLMProvider = "claude" | "openai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "openai";
  if (provider !== "claude" && provider !== "openai") {
    throw new Error(`Unknown LLM_PROVIDER: ${provider}. Must be "claude" or "openai".`);
  }
  return provider;
}

async function claudeChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER is 'claude'.");
  }

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find(
    (block: { type: string; text?: string }) => block.type === "text"
  );
  return textBlock?.text || "";
}

async function openaiChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER is 'openai'.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = getProvider();

  switch (provider) {
    case "claude":
      return claudeChat(systemPrompt, userPrompt);
    case "openai":
      return openaiChat(systemPrompt, userPrompt);
  }
}

// --- Streaming support for chat ---

async function claudeStreamRaw(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER is 'claude'.");
  }
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }
  return response;
}

async function openaiStreamRaw(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER is 'openai'.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }
  return response;
}

function parseClaudeSSE(raw: Response): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = raw.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              controller.enqueue(encoder.encode(parsed.delta.text));
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    },
  });
}

function parseOpenAISSE(raw: Response): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = raw.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    },
  });
}

export async function chatCompletionStream(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 4096
): Promise<ReadableStream<Uint8Array>> {
  const provider = getProvider();

  switch (provider) {
    case "claude": {
      const raw = await claudeStreamRaw(systemPrompt, messages, maxTokens);
      return parseClaudeSSE(raw);
    }
    case "openai": {
      const raw = await openaiStreamRaw(systemPrompt, messages, maxTokens);
      return parseOpenAISSE(raw);
    }
  }
}
