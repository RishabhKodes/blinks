import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, or } from "drizzle-orm";
import { compileTopic } from "@/lib/llm/compile";
import { writeTopicFile, resourceSlug, ensureVaultStructure } from "@/lib/vault";

interface CompileResult {
  topicId: string;
  topicName: string;
  status: "compiled" | "error";
  error?: string;
}

const TOPIC_NOT_FOUND_ERROR = "Topic not found";
const COMPILE_FAILED_ERROR = "Compilation failed";

async function compileOneTopic(topicId: string): Promise<CompileResult> {
  const db = await getDb();

  const topic = await db.select().from(schema.topics).where(eq(schema.topics.id, topicId)).get();
  if (!topic) {
    return { topicId, topicName: topicId, status: "error", error: TOPIC_NOT_FOUND_ERROR };
  }

  const resourceIds = await db
    .select({ resourceId: schema.resourceTopics.resourceId })
    .from(schema.resourceTopics)
    .where(eq(schema.resourceTopics.topicId, topicId));

  const resources = [];
  for (const r of resourceIds) {
    const res = await db.select().from(schema.resources).where(eq(schema.resources.id, r.resourceId)).get();
    if (res) resources.push(res);
  }

  const links = await db
    .select()
    .from(schema.topicLinks)
    .where(
      or(
        eq(schema.topicLinks.sourceTopicId, topicId),
        eq(schema.topicLinks.targetTopicId, topicId)
      )
    );

  const relatedTopicIds = new Set<string>();
  for (const link of links) {
    if (link.sourceTopicId !== topicId) relatedTopicIds.add(link.sourceTopicId);
    if (link.targetTopicId !== topicId) relatedTopicIds.add(link.targetTopicId);
  }

  const relatedTopicNames = [];
  for (const id of relatedTopicIds) {
    const t = await db.select().from(schema.topics).where(eq(schema.topics.id, id)).get();
    relatedTopicNames.push(t?.name || id);
  }

  try {
    const compiled = await compileTopic(
      topic.name,
      topic.description,
      resources.map((r) => ({
        title: r.title,
        summary: r.summary,
        keyConcepts: [],
        connections: [],
      })),
      relatedTopicNames
    );

    const now = new Date().toISOString();

    await db.update(schema.topics)
      .set({ description: compiled, updatedAt: now })
      .where(eq(schema.topics.id, topicId));

    const existing = await db.select().from(schema.wikiCompilations).where(eq(schema.wikiCompilations.topicId, topicId)).get();
    if (existing) {
      await db.update(schema.wikiCompilations)
        .set({ compiledAt: now, status: "compiled" })
        .where(eq(schema.wikiCompilations.topicId, topicId));
    } else {
      await db.insert(schema.wikiCompilations)
        .values({ topicId, compiledAt: now, status: "compiled" });
    }

    ensureVaultStructure();
    const backlinks = relatedTopicNames.map((n) => `[[${n}]]`);
    const resourceEntries = resources.map((r) => `[[${resourceSlug(r.title)}]] - ${r.title}`);
    writeTopicFile(
      {
        id: topicId,
        name: topic.name,
        description: compiled,
        backlinks,
        resource_count: resources.length,
        created: topic.createdAt,
        updated: now,
      },
      resourceEntries
    );

    return { topicId, topicName: topic.name, status: "compiled" };
  } catch (error) {
    console.error(`Topic compile failed (${topicId}):`, error);
    const now = new Date().toISOString();
    const existing = await db.select().from(schema.wikiCompilations).where(eq(schema.wikiCompilations.topicId, topicId)).get();
    if (existing) {
      await db.update(schema.wikiCompilations)
        .set({ compiledAt: now, status: "error" })
        .where(eq(schema.wikiCompilations.topicId, topicId));
    } else {
      await db.insert(schema.wikiCompilations)
        .values({ topicId, compiledAt: now, status: "error" });
    }
    return { topicId, topicName: topic.name, status: "error", error: COMPILE_FAILED_ERROR };
  }
}

export async function POST(request: Request) {
  let body: { topicId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topicId } = body;
  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400 });
  }

  if (topicId === "all") {
    const db = await getDb();
    const allTopics = await db.select().from(schema.topics);
    const results: CompileResult[] = [];
    for (const topic of allTopics) {
      const result = await compileOneTopic(topic.id);
      results.push(result);
    }
    return NextResponse.json({ results });
  }

  const result = await compileOneTopic(topicId);
  if (result.status === "error") {
    const status = result.error === TOPIC_NOT_FOUND_ERROR ? 404 : 500;
    return NextResponse.json({ error: result.error, result }, { status });
  }
  return NextResponse.json({ result });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topicId");

  const db = await getDb();

  if (topicId) {
    const compilation = await db.select().from(schema.wikiCompilations).where(eq(schema.wikiCompilations.topicId, topicId)).get();
    return NextResponse.json(compilation || null);
  }

  const all = await db.select().from(schema.wikiCompilations);
  return NextResponse.json(all);
}
