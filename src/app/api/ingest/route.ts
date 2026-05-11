import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  slugify,
  resourceSlug,
  writeResourceFile,
  ensureVaultStructure,
} from "@/lib/vault";
import { fetchContent } from "@/lib/content/fetcher";
import { classifyResource } from "@/lib/llm/classify";
import type { GraphContext } from "@/lib/llm/classify";

async function getGraphContext(): Promise<GraphContext> {
  const db = await getDb();
  const allTopics = await db.select().from(schema.topics);

  return {
    existingTopics: allTopics.map((t) => t.name),
  };
}

export async function POST(request: Request) {
  let body: { url?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, notes } = body;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const db = await getDb();

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

  let content;
  try {
    content = await fetchContent(url);
  } catch (error) {
    console.error("Content fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch content from URL" },
      { status: 502 }
    );
  }

  const graphContext = await getGraphContext();
  const classification = await classifyResource(content, graphContext, notes);

  const id = uuidv4();
  const now = new Date().toISOString();

  const isUrlTitle = content.title === content.url || content.title.startsWith("http");
  const title = (isUrlTitle && classification.title) ? classification.title : content.title;

  const slug = resourceSlug(title);
  ensureVaultStructure();

  await db.insert(schema.resources)
    .values({
      id,
      url: content.url,
      title,
      type: content.type,
      author: content.author,
      source: content.source,
      thumbnail: content.thumbnail,
      summary: classification.summary,
      savedAt: now,
    });

  const topicBacklinks: string[] = [];
  for (const topicName of classification.topics) {
    const topicId = slugify(topicName);
    const existingTopic = await db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, topicId))
      .get();

    if (!existingTopic) {
      await db.insert(schema.topics)
        .values({ id: topicId, name: topicName, description: "", createdAt: now, updatedAt: now });
    }

    await db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId });

    topicBacklinks.push(`[[${topicName}]]`);
  }

  for (const [topicA, topicB] of classification.topicRelationships) {
    const idA = slugify(topicA);
    const idB = slugify(topicB);
    if (idA === idB) continue;

    for (const [tid, tname] of [[idA, topicA], [idB, topicB]] as const) {
      const exists = await db.select().from(schema.topics).where(eq(schema.topics.id, tid)).get();
      if (!exists) {
        await db.insert(schema.topics)
          .values({ id: tid, name: tname, description: "", createdAt: now, updatedAt: now });
      }
    }

    const existingLink = await db
      .select()
      .from(schema.topicLinks)
      .where(and(eq(schema.topicLinks.sourceTopicId, idA), eq(schema.topicLinks.targetTopicId, idB)))
      .get();
    const reverseLink = await db
      .select()
      .from(schema.topicLinks)
      .where(and(eq(schema.topicLinks.sourceTopicId, idB), eq(schema.topicLinks.targetTopicId, idA)))
      .get();

    if (!existingLink && !reverseLink) {
      await db.insert(schema.topicLinks)
        .values({ sourceTopicId: idA, targetTopicId: idB });
    }
  }

  const primaryTopicId = slugify(classification.topics[0] || "uncategorized");
  writeResourceFile(
    primaryTopicId,
    slug,
    {
      url: content.url,
      title,
      type: content.type,
      author: content.author,
      source: content.source,
      thumbnail: content.thumbnail,
      topics: topicBacklinks,
      saved: now,
    },
    {
      summary: classification.summary,
      keyConcepts: classification.keyConcepts,
      whyItMatters: classification.whyItMatters,
      connections: classification.connections,
    }
  );

  return NextResponse.json(
    {
      resource: { id, url: content.url, title, type: content.type, topics: classification.topics },
      classification,
    },
    { status: 201 }
  );
}
