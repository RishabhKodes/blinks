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
import { classifyResource, findRelatedResources } from "@/lib/llm/classify";
import type { GraphContext, ExistingResource } from "@/lib/llm/classify";

function getGraphContext(): GraphContext {
  const db = getDb();
  const allTopics = db.select().from(schema.topics).all();

  return {
    existingTopics: allTopics.map((t) => t.name),
  };
}

// POST /api/ingest -- full ingestion pipeline
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

  const db = getDb();

  // Check for duplicate URL
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

  // Step 1: Fetch content
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

  // Step 2: Get graph context (existing topics)
  const graphContext = getGraphContext();

  // Step 3: Classify with LLM
  const classification = await classifyResource(content, graphContext, notes);

  // Step 4: Create resource
  const id = uuidv4();
  const now = new Date().toISOString();

  // Prefer LLM-generated title when the fetcher only returned the URL
  const isUrlTitle = content.title === content.url || content.title.startsWith("http");
  const title = (isUrlTitle && classification.title) ? classification.title : content.title;

  const slug = resourceSlug(title);
  ensureVaultStructure();

  db.insert(schema.resources)
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
    })
    .run();

  // Step 5: Ensure topics exist and link resource to them
  const topicBacklinks: string[] = [];
  for (const topicName of classification.topics) {
    const topicId = slugify(topicName);
    const existingTopic = db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, topicId))
      .get();

    if (!existingTopic) {
      db.insert(schema.topics)
        .values({ id: topicId, name: topicName, description: "", createdAt: now, updatedAt: now })
        .run();
    }

    db.insert(schema.resourceTopics)
      .values({ resourceId: id, topicId })
      .run();

    topicBacklinks.push(`[[${topicName}]]`);
  }

  // Step 6: Create topic-to-topic links from LLM relationships
  for (const [topicA, topicB] of classification.topicRelationships) {
    const idA = slugify(topicA);
    const idB = slugify(topicB);
    if (idA === idB) continue;

    // Ensure both topics exist (LLM may reference existing topics)
    for (const [tid, tname] of [[idA, topicA], [idB, topicB]] as const) {
      const exists = db.select().from(schema.topics).where(eq(schema.topics.id, tid)).get();
      if (!exists) {
        db.insert(schema.topics)
          .values({ id: tid, name: tname, description: "", createdAt: now, updatedAt: now })
          .run();
      }
    }

    // Check if link already exists (either direction)
    const existingLink = db
      .select()
      .from(schema.topicLinks)
      .where(and(eq(schema.topicLinks.sourceTopicId, idA), eq(schema.topicLinks.targetTopicId, idB)))
      .get();
    const reverseLink = db
      .select()
      .from(schema.topicLinks)
      .where(and(eq(schema.topicLinks.sourceTopicId, idB), eq(schema.topicLinks.targetTopicId, idA)))
      .get();

    if (!existingLink && !reverseLink) {
      db.insert(schema.topicLinks)
        .values({ sourceTopicId: idA, targetTopicId: idB })
        .run();
    }
  }

  // Step 7: Find related resources via LLM and create resource-to-resource links
  const allExisting = db
    .select()
    .from(schema.resources)
    .all()
    .filter((r) => r.id !== id && !r.archivedAt);

  if (allExisting.length > 0) {
    // Build existing resources with their topics for the LLM
    const existingForLLM: ExistingResource[] = allExisting.map((r) => {
      const rTopics = db
        .select({ topicId: schema.resourceTopics.topicId })
        .from(schema.resourceTopics)
        .where(eq(schema.resourceTopics.resourceId, r.id))
        .all();
      const topicNames = rTopics
        .map((rt) => {
          const t = db.select().from(schema.topics).where(eq(schema.topics.id, rt.topicId)).get();
          return t?.name;
        })
        .filter(Boolean) as string[];
      return { id: r.id, title: r.title, summary: r.summary, topics: topicNames };
    });

    const connections = await findRelatedResources(
      { title, summary: classification.summary, topics: classification.topics },
      existingForLLM
    );

    for (const conn of connections) {
      // Insert both directions for undirected edge
      db.insert(schema.resourceLinks)
        .values({ sourceResourceId: id, targetResourceId: conn.resourceId })
        .run();
    }
  }

  // Step 8: Write markdown file
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
