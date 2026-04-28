import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { lintKnowledgeBase, type LintTopic, type LintLink, type LintResource } from "@/lib/llm/lint";
import { slugify } from "@/lib/vault";

// GET /api/lint -- return stored lint results
export async function GET() {
  const db = getDb();
  const results = db.select().from(schema.lintResults).all();
  return NextResponse.json(results);
}

// POST /api/lint -- run lint and store results
export async function POST() {
  const db = getDb();

  const allTopics = db.select().from(schema.topics).all();
  const allLinks = db.select().from(schema.topicLinks).all();
  const allResources = db.select().from(schema.resources).all();

  if (allTopics.length === 0 && allResources.length === 0) {
    return NextResponse.json({ results: [], message: "Knowledge base is empty" });
  }

  const topics: LintTopic[] = allTopics.map((t) => ({
    name: t.name,
    description: t.description,
    resourceCount: db
      .select()
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.topicId, t.id))
      .all().length,
  }));

  const topicLinks: LintLink[] = allLinks.map((l) => {
    const src = allTopics.find((t) => t.id === l.sourceTopicId);
    const tgt = allTopics.find((t) => t.id === l.targetTopicId);
    return {
      source: src?.name || l.sourceTopicId,
      target: tgt?.name || l.targetTopicId,
    };
  });

  const resources: LintResource[] = allResources.map((r) => {
    const topicRows = db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id))
      .all();
    const topicNames = topicRows.map((tr) => {
      const topic = allTopics.find((t) => t.id === tr.topicId);
      return topic?.name || tr.topicId;
    });
    return { title: r.title, summary: r.summary, topics: topicNames };
  });

  try {
    const findings = await lintKnowledgeBase(topics, topicLinks, resources);

    // Clear old results
    db.delete(schema.lintResults).run();

    // Insert new results
    const now = new Date().toISOString();
    for (const f of findings) {
      const topicId = f.topicName ? slugify(f.topicName) : null;
      // Only reference topicId if the topic actually exists
      const validTopicId = topicId
        ? db.select().from(schema.topics).where(eq(schema.topics.id, topicId)).get()
          ? topicId
          : null
        : null;

      db.insert(schema.lintResults)
        .values({
          id: uuidv4(),
          type: f.type,
          severity: f.severity,
          title: f.title,
          description: f.description,
          topicId: validTopicId,
          suggestion: f.suggestion,
          resolved: 0,
          createdAt: now,
        })
        .run();
    }

    const results = db.select().from(schema.lintResults).all();
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lint failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
