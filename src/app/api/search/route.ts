import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { like, or, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ topics: [], resources: [] });
  }

  const db = await getDb();
  const pattern = `%${query}%`;

  const matchedTopics = await db
    .select()
    .from(schema.topics)
    .where(
      or(
        like(schema.topics.name, pattern),
        like(schema.topics.description, pattern)
      )
    );

  const matchedResources = await db
    .select()
    .from(schema.resources)
    .where(
      or(
        like(schema.resources.title, pattern),
        like(schema.resources.summary, pattern),
        like(schema.resources.author, pattern),
        like(schema.resources.source, pattern)
      )
    );

  const resourcesWithTopics = [];
  for (const r of matchedResources) {
    const topicRows = await db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id));
    resourcesWithTopics.push({ ...r, topics: topicRows.map((t) => t.topicId) });
  }

  return NextResponse.json({
    topics: matchedTopics,
    resources: resourcesWithTopics,
  });
}
