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

async function compileOneTopic(topicId: string): Promise<CompileResult> {
  const db = getDb();

  const topic = db.select().from(schema.topics).where(eq(schema.topics.id, topicId)).get();
  if (!topic) {
    return { topicId, topicName: topicId, status: "error", error: "Topic not found" };
  }

  // Load resources for this topic
  const resourceIds = db
    .select({ resourceId: schema.resourceTopics.resourceId })
    .from(schema.resourceTopics)
    .where(eq(schema.resourceTopics.topicId, topicId))
    .all();

  const resources = resourceIds.map((r) =>
    db.select().from(schema.resources).where(eq(schema.resources.id, r.resourceId)).get()
  ).filter(Boolean);

  // Load related topics via topic links
  const links = db
    .select()
    .from(schema.topicLinks)
    .where(
      or(
        eq(schema.topicLinks.sourceTopicId, topicId),
        eq(schema.topicLinks.targetTopicId, topicId)
      )
    )
    .all();

  const relatedTopicIds = new Set<string>();
  for (const link of links) {
    if (link.sourceTopicId !== topicId) relatedTopicIds.add(link.sourceTopicId);
    if (link.targetTopicId !== topicId) relatedTopicIds.add(link.targetTopicId);
  }

  const relatedTopicNames = [...relatedTopicIds].map((id) => {
    const t = db.select().from(schema.topics).where(eq(schema.topics.id, id)).get();
    return t?.name || id;
  });

  // Compile
  try {
    const compiled = await compileTopic(
      topic.name,
      topic.description,
      resources.map((r) => ({
        title: r!.title,
        summary: r!.summary,
        keyConcepts: [],
        connections: [],
      })),
      relatedTopicNames
    );

    const now = new Date().toISOString();

    // Update topic description in DB
    db.update(schema.topics)
      .set({ description: compiled, updatedAt: now })
      .where(eq(schema.topics.id, topicId))
      .run();

    // Update compilation tracking
    const existing = db.select().from(schema.wikiCompilations).where(eq(schema.wikiCompilations.topicId, topicId)).get();
    if (existing) {
      db.update(schema.wikiCompilations)
        .set({ compiledAt: now, status: "compiled" })
        .where(eq(schema.wikiCompilations.topicId, topicId))
        .run();
    } else {
      db.insert(schema.wikiCompilations)
        .values({ topicId, compiledAt: now, status: "compiled" })
        .run();
    }

    // Rewrite vault file
    ensureVaultStructure();
    const backlinks = relatedTopicNames.map((n) => `[[${n}]]`);
    const resourceEntries = resources.map((r) => `[[${resourceSlug(r!.title)}]] - ${r!.title}`);
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
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Track failure
    const now = new Date().toISOString();
    const existing = db.select().from(schema.wikiCompilations).where(eq(schema.wikiCompilations.topicId, topicId)).get();
    if (existing) {
      db.update(schema.wikiCompilations)
        .set({ compiledAt: now, status: "error" })
        .where(eq(schema.wikiCompilations.topicId, topicId))
        .run();
    } else {
      db.insert(schema.wikiCompilations)
        .values({ topicId, compiledAt: now, status: "error" })
        .run();
    }
    return { topicId, topicName: topic.name, status: "error", error: msg };
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
    const db = getDb();
    const allTopics = db.select().from(schema.topics).all();
    const results: CompileResult[] = [];
    for (const topic of allTopics) {
      const result = await compileOneTopic(topic.id);
      results.push(result);
    }
    return NextResponse.json({ results });
  }

  const result = await compileOneTopic(topicId);
  if (result.status === "error") {
    return NextResponse.json({ error: result.error, result }, { status: 500 });
  }
  return NextResponse.json({ result });
}

// GET compilation status for a topic
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topicId");

  const db = getDb();

  if (topicId) {
    const compilation = db.select().from(schema.wikiCompilations).where(eq(schema.wikiCompilations.topicId, topicId)).get();
    return NextResponse.json(compilation || null);
  }

  const all = db.select().from(schema.wikiCompilations).all();
  return NextResponse.json(all);
}
