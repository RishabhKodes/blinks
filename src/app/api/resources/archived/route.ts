import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { isNotNull, eq } from "drizzle-orm";

export async function GET() {
  const db = await getDb();

  const archived = await db
    .select()
    .from(schema.resources)
    .where(isNotNull(schema.resources.archivedAt));

  const result = [];
  for (const r of archived) {
    const topicRows = await db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id));
    const topics = [];
    for (const t of topicRows) {
      const topic = await db
        .select({ name: schema.topics.name })
        .from(schema.topics)
        .where(eq(schema.topics.id, t.topicId))
        .get();
      topics.push(topic?.name || t.topicId);
    }
    result.push({ ...r, topics });
  }

  return NextResponse.json(result);
}
