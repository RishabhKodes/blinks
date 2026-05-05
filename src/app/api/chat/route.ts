import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { chatCompletionStream, type ChatMessage } from "@/lib/llm";
import { buildQASystemPrompt, type QATopic, type QAResource, type QALink } from "@/lib/llm/qa";

function toPublicErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "LLM request failed";

  const message = error.message;
  const isConfigError =
    message.startsWith("OPENAI_API_KEY is required") ||
    message.startsWith("ANTHROPIC_API_KEY is required") ||
    message.startsWith("Unknown LLM_PROVIDER:");

  return isConfigError ? message : "LLM request failed";
}

function loadKBContext() {
  const db = getDb();

  const allTopics = db.select().from(schema.topics).all();
  const allResources = db.select().from(schema.resources).all();
  const allLinks = db.select().from(schema.topicLinks).all();

  const topics: QATopic[] = allTopics.map((t) => ({
    name: t.name,
    description: t.description,
    resourceCount: db
      .select()
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.topicId, t.id))
      .all().length,
  }));

  const resources: QAResource[] = allResources.map((r) => {
    const topicRows = db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id))
      .all();
    const topicNames = topicRows.map((tr) => {
      const topic = allTopics.find((t) => t.id === tr.topicId);
      return topic?.name || tr.topicId;
    });
    return {
      title: r.title,
      summary: r.summary,
      url: r.url,
      source: r.source,
      type: r.type,
      topics: topicNames,
    };
  });

  const topicLinks: QALink[] = allLinks.map((l) => {
    const src = allTopics.find((t) => t.id === l.sourceTopicId);
    const tgt = allTopics.find((t) => t.id === l.targetTopicId);
    return {
      source: src?.name || l.sourceTopicId,
      target: tgt?.name || l.targetTopicId,
    };
  });

  return { topics, resources, topicLinks };
}

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = body.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { topics, resources, topicLinks } = loadKBContext();

  if (topics.length === 0 && resources.length === 0) {
    return new Response(
      "Your knowledge base is empty. Add some resources first using the + Add button, then come back to ask questions.",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const systemPrompt = buildQASystemPrompt(topics, resources, topicLinks);

  try {
    const stream = await chatCompletionStream(systemPrompt, messages);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Chat completion failed:", error);
    return new Response(JSON.stringify({ error: toPublicErrorMessage(error) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
