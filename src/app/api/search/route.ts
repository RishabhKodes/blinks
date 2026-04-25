import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { like, or, eq } from "drizzle-orm";

// GET /api/search?q=query -- search topics and resources
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ topics: [], resources: [] });
  }

  const db = getDb();
  const pattern = `%${query}%`;

  // Search topics by name or description
  const matchedTopics = db
    .select()
    .from(schema.topics)
    .where(
      or(
        like(schema.topics.name, pattern),
        like(schema.topics.description, pattern)
      )
    )
    .all();

  // Search resources by title, summary, author, or source
  const matchedResources = db
    .select()
    .from(schema.resources)
    .where(
      or(
        like(schema.resources.title, pattern),
        like(schema.resources.summary, pattern),
        like(schema.resources.author, pattern),
        like(schema.resources.source, pattern)
      )
    )
    .all();

  // Attach topics to each resource
  const resourcesWithTopics = matchedResources.map((r) => {
    const topicRows = db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id))
      .all();
    return { ...r, topics: topicRows.map((t) => t.topicId) };
  });

  return NextResponse.json({
    topics: matchedTopics,
    resources: resourcesWithTopics,
  });
}
