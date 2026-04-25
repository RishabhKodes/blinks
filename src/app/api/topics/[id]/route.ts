import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET /api/topics/:id -- get topic with its resources
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const topic = db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, id))
    .get();

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Get all resource IDs for this topic
  const resourceTopicRows = db
    .select({ resourceId: schema.resourceTopics.resourceId })
    .from(schema.resourceTopics)
    .where(eq(schema.resourceTopics.topicId, id))
    .all();

  // Fetch full resource details
  const resources = resourceTopicRows
    .map((rt) =>
      db
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.id, rt.resourceId))
        .get()
    )
    .filter(Boolean);

  return NextResponse.json({
    ...topic,
    resources,
  });
}
