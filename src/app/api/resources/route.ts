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

// GET /api/resources -- list all resources
export async function GET() {
  const db = getDb();
  const allResources = db.select().from(schema.resources).all();

  // Attach topics to each resource
  const result = allResources.map((r) => {
    const topicRows = db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id))
      .all();
    const topicIds = topicRows.map((t) => t.topicId);
    return { ...r, topics: topicIds };
  });

  return NextResponse.json(result);
}

// POST /api/resources -- create a new resource (called after LLM classification)
export async function POST(request: Request) {
  const body = await request.json();
  const {
    url,
    title,
    type = "other",
    author = "",
    source = "",
    thumbnail = "",
    summary = "",
    keyConcepts = [],
    whyItMatters = "",
    connections = [],
    topics: topicNames = [],
  } = body;

  if (!url || !title) {
    return NextResponse.json(
      { error: "url and title are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  ensureVaultStructure();

  // Check duplicate URL
  const existing = db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.url, url))
    .get();
  if (existing) {
    return NextResponse.json(
      { error: "Resource with this URL already exists", resource: existing },
      { status: 409 }
    );
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const slug = resourceSlug(title);

  // Insert resource
  db.insert(schema.resources)
    .values({
      id,
      url,
      title,
      type,
      author,
      source,
      thumbnail,
      summary,
      savedAt: now,
    })
    .run();

  // Ensure topics exist and link them
  const topicBacklinks: string[] = [];
  for (const topicName of topicNames) {
    const topicId = slugify(topicName);
    const existingTopic = db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, topicId))
      .get();

    if (!existingTopic) {
      db.insert(schema.topics)
        .values({
          id: topicId,
          name: topicName,
          description: "",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } else {
      db.update(schema.topics)
        .set({ updatedAt: now })
        .where(eq(schema.topics.id, topicId))
        .run();
    }

    // Link resource to topic
    db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId })
      .run();

    topicBacklinks.push(`[[${topicName}]]`);
  }

  // Write resource markdown file (to the first topic's directory)
  const primaryTopicId = slugify(topicNames[0] || "uncategorized");
  if (topicNames.length === 0) {
    // Ensure uncategorized topic exists
    const uncatExists = db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, "uncategorized"))
      .get();
    if (!uncatExists) {
      db.insert(schema.topics)
        .values({
          id: "uncategorized",
          name: "Uncategorized",
          description: "Resources not yet classified",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId: "uncategorized" })
      .run();
  }

  writeResourceFile(
    primaryTopicId,
    slug,
    {
      url,
      title,
      type,
      author,
      source,
      thumbnail,
      topics: topicBacklinks,
      saved: now,
    },
    {
      summary,
      keyConcepts,
      whyItMatters,
      connections,
    }
  );

  // Update topic markdown files
  for (const topicName of topicNames) {
    const topicId = slugify(topicName);
    const topicResources = db
      .select({ resourceId: schema.resourceTopics.resourceId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.topicId, topicId))
      .all();

    const resourceEntries = topicResources.map((tr) => {
      const r = db
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.id, tr.resourceId))
        .get();
      return r ? `[[${resourceSlug(r.title)}]] - ${r.title}` : "";
    }).filter(Boolean);

    const topicLinksRows = db
      .select({ targetTopicId: schema.topicLinks.targetTopicId })
      .from(schema.topicLinks)
      .where(eq(schema.topicLinks.sourceTopicId, topicId))
      .all();
    const backlinks = topicLinksRows.map((l) => {
      const t = db
        .select()
        .from(schema.topics)
        .where(eq(schema.topics.id, l.targetTopicId))
        .get();
      return t ? `[[${t.name}]]` : "";
    }).filter(Boolean);

    const topic = db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, topicId))
      .get();
    if (topic) {
      writeTopicFile(
        {
          id: topicId,
          name: topic.name,
          description: topic.description,
          backlinks,
          resource_count: topicResources.length,
          created: topic.createdAt,
          updated: now,
        },
        resourceEntries
      );
    }
  }

  return NextResponse.json({ id, url, title, type, topics: topicNames }, { status: 201 });
}
