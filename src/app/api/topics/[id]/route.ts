import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  const topic = await db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, id))
    .get();

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const resourceTopicRows = await db
    .select({ resourceId: schema.resourceTopics.resourceId })
    .from(schema.resourceTopics)
    .where(eq(schema.resourceTopics.topicId, id));

  const resources = [];
  for (const rt of resourceTopicRows) {
    const r = await db
      .select()
      .from(schema.resources)
      .where(eq(schema.resources.id, rt.resourceId))
      .get();
    if (r) resources.push(r);
  }

  return NextResponse.json({
    ...topic,
    resources,
  });
}
