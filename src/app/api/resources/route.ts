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
import { sanitizeTopicNames } from "@/lib/graph/connections";

export async function GET() {
  const db = await getDb();
  const allResources = await db.select().from(schema.resources);

  const result = [];
  for (const r of allResources) {
    const topicRows = await db
      .select({ topicId: schema.resourceTopics.topicId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.resourceId, r.id));
    const topicIds = topicRows.map((t) => t.topicId);
    result.push({ ...r, topics: topicIds });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
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
    topics: requestedTopicNames = [],
  } = body as {
    url?: string;
    title?: string;
    type?: string;
    author?: string;
    source?: string;
    thumbnail?: string;
    summary?: string;
    keyConcepts?: string[];
    whyItMatters?: string;
    connections?: string[];
    topics?: string[];
  };
  const topicNames = sanitizeTopicNames(requestedTopicNames);

  if (!url || !title) {
    return NextResponse.json(
      { error: "url and title are required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  ensureVaultStructure();

  const existing = await db
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

  await db.insert(schema.resources)
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
    });

  const topicBacklinks: string[] = [];
  for (const topicName of topicNames) {
    const topicId = slugify(topicName);
    const existingTopic = await db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, topicId))
      .get();

    if (!existingTopic) {
      await db.insert(schema.topics)
        .values({
          id: topicId,
          name: topicName,
          description: "",
          createdAt: now,
          updatedAt: now,
        });
    } else {
      await db.update(schema.topics)
        .set({ updatedAt: now })
        .where(eq(schema.topics.id, topicId));
    }

    await db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId });

    topicBacklinks.push(`[[${topicName}]]`);
  }

  const primaryTopicId = slugify(topicNames[0] || "uncategorized");
  if (topicNames.length === 0) {
    const uncatExists = await db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, "uncategorized"))
      .get();
    if (!uncatExists) {
      await db.insert(schema.topics)
        .values({
          id: "uncategorized",
          name: "Uncategorized",
          description: "Resources not yet classified",
          createdAt: now,
          updatedAt: now,
        });
    }
    await db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId: "uncategorized" });
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

  for (const topicName of topicNames) {
    const topicId = slugify(topicName);
    const topicResources = await db
      .select({ resourceId: schema.resourceTopics.resourceId })
      .from(schema.resourceTopics)
      .where(eq(schema.resourceTopics.topicId, topicId));

    const resourceEntries = [];
    for (const tr of topicResources) {
      const r = await db
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.id, tr.resourceId))
        .get();
      if (r) resourceEntries.push(`[[${resourceSlug(r.title)}]] - ${r.title}`);
    }

    const topicLinksRows = await db
      .select({ targetTopicId: schema.topicLinks.targetTopicId })
      .from(schema.topicLinks)
      .where(eq(schema.topicLinks.sourceTopicId, topicId));
    const backlinks = [];
    for (const l of topicLinksRows) {
      const t = await db
        .select()
        .from(schema.topics)
        .where(eq(schema.topics.id, l.targetTopicId))
        .get();
      if (t) backlinks.push(`[[${t.name}]]`);
    }

    const topic = await db
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
