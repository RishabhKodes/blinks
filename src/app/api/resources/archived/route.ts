import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { isNotNull, eq } from "drizzle-orm";

// GET /api/resources/archived -- list archived resources
export async function GET() {
  const db = getDb();

  const archived = db
    .select()
    .from(schema.resources)
    .where(isNotNull(schema.resources.archivedAt))
    .all();

  const result = archived.map((r) => {
    const topicRows = db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id))
      .all();
    const topics = topicRows.map((t) => {
      const topic = db
        .select({ name: schema.topics.name })
        .from(schema.topics)
        .where(eq(schema.topics.id, t.topicId))
        .get();
      return topic?.name || t.topicId;
    });
    return { ...r, topics };
  });

  return NextResponse.json(result);
}
