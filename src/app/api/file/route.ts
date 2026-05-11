import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  slugify,
  resourceSlug,
  writeResourceFile,
  writeTopicFile,
  ensureVaultStructure,
} from "@/lib/vault";

export async function POST(request: Request) {
  let body: {
    content?: string;
    title?: string;
    action?: "enhance_topic" | "new_resource";
    topicId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content, title, action, topicId } = body;

  if (!content || !action || !topicId) {
    return NextResponse.json(
      { error: "content, action, and topicId are required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const topic = await db.select().from(schema.topics).where(eq(schema.topics.id, topicId)).get();
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  ensureVaultStructure();
  const now = new Date().toISOString();

  if (action === "enhance_topic") {
    const separator = topic.description ? "\n\n## Q&A Insights\n\n" : "";
    const newDescription = topic.description
      ? (topic.description.includes("## Q&A Insights")
          ? topic.description + "\n\n" + content
          : topic.description + separator + content)
      : content;

    await db.update(schema.topics)
      .set({ description: newDescription, updatedAt: now })
      .where(eq(schema.topics.id, topicId));

    const resourceIds = await db
      .select({ resourceId: schema.resourceTopics.resourceId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.topicId, topicId));

    const resourceEntries = [];
    for (const r of resourceIds) {
      const res = await db.select().from(schema.resources).where(eq(schema.resources.id, r.resourceId)).get();
      if (res) resourceEntries.push(`[[${resourceSlug(res.title)}]] - ${res.title}`);
    }

    const linkRows = await db.select().from(schema.topicLinks);
    const backlinks = [];
    for (const l of linkRows) {
      if (l.sourceTopicId !== topicId && l.targetTopicId !== topicId) continue;
      const otherId = l.sourceTopicId === topicId ? l.targetTopicId : l.sourceTopicId;
      const other = await db.select().from(schema.topics).where(eq(schema.topics.id, otherId)).get();
      if (other) backlinks.push(`[[${other.name}]]`);
    }

    writeTopicFile(
      {
        id: topicId,
        name: topic.name,
        description: newDescription,
        backlinks,
        resource_count: resourceIds.length,
        created: topic.createdAt,
        updated: now,
      },
      resourceEntries
    );

    return NextResponse.json({ success: true, action: "enhance_topic", topicId });
  }

  if (action === "new_resource") {
    const resourceTitle = title || "Q&A Note";
    const id = uuidv4();
    const slug = resourceSlug(resourceTitle);

    await db.insert(schema.resources)
      .values({
        id,
        url: `qa://${slug}-${Date.now()}`,
        title: resourceTitle,
        type: "note",
        author: "",
        source: "qa-output",
        thumbnail: "",
        summary: content.slice(0, 500),
        savedAt: now,
      });

    await db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId });

    writeResourceFile(
      topicId,
      slug,
      {
        url: `qa://${slug}`,
        title: resourceTitle,
        type: "note",
        author: "",
        source: "qa-output",
        thumbnail: "",
        topics: [`[[${topic.name}]]`],
        saved: now,
      },
      {
        summary: content,
        keyConcepts: [],
        whyItMatters: "",
        connections: [],
      }
    );

    return NextResponse.json({ success: true, action: "new_resource", resourceId: id }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
