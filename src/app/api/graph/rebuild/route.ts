import { NextResponse } from "next/server";
import { eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  findRelatedResources,
  type ExistingResource,
  type ResourceConnection,
} from "@/lib/llm/classify";
import {
  canonicalResourcePair,
  isPlaceholderTopic,
} from "@/lib/graph/connections";

interface ProposedConnection extends ResourceConnection {
  sourceResourceId: string;
  targetResourceId: string;
}

async function loadResources(): Promise<ExistingResource[]> {
  const db = await getDb();
  const [resources, resourceTopics, topics] = await Promise.all([
    db.select().from(schema.resources).where(isNull(schema.resources.archivedAt)),
    db.select().from(schema.resourceTopics),
    db.select().from(schema.topics),
  ]);

  const topicNameById = new Map(
    topics
      .filter((topic) => !isPlaceholderTopic(topic.name))
      .map((topic) => [topic.id, topic.name])
  );
  const topicsByResource = new Map<string, string[]>();

  for (const resourceTopic of resourceTopics) {
    const topicName = topicNameById.get(resourceTopic.topicId);
    if (!topicName) continue;
    const names = topicsByResource.get(resourceTopic.resourceId) ?? [];
    names.push(topicName);
    topicsByResource.set(resourceTopic.resourceId, names);
  }

  return resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    summary: resource.summary,
    topics: topicsByResource.get(resource.id) ?? [],
  }));
}

export async function GET() {
  const db = await getDb();
  const [resources, links] = await Promise.all([
    db.select({ id: schema.resources.id }).from(schema.resources)
      .where(isNull(schema.resources.archivedAt)),
    db.select({
      origin: schema.resourceLinks.origin,
    }).from(schema.resourceLinks),
  ]);

  return NextResponse.json({
    resourceCount: resources.length,
    connectionCount: links.length,
    generatedConnectionCount: links.filter(
      (link) => link.origin === "semantic-v2"
    ).length,
  });
}

export async function POST() {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const hasKey =
    provider === "openai"
      ? !!process.env.OPENAI_API_KEY
      : !!process.env.ANTHROPIC_API_KEY;
  if (!hasKey) {
    return NextResponse.json(
      { error: "An LLM API key is required to rebuild connections" },
      { status: 503 }
    );
  }

  const resources = await loadResources();
  const proposedByPair = new Map<string, ProposedConnection>();

  try {
    for (const resource of resources) {
      const candidates = resources.filter((candidate) => candidate.id !== resource.id);
      const related = await findRelatedResources(resource, candidates);

      for (const connection of related) {
        const [sourceResourceId, targetResourceId] = canonicalResourcePair(
          resource.id,
          connection.resourceId
        );
        const key = `${sourceResourceId}->${targetResourceId}`;
        const existing = proposedByPair.get(key);
        if (!existing || connection.confidence > existing.confidence) {
          proposedByPair.set(key, {
            ...connection,
            sourceResourceId: resource.id,
            targetResourceId: connection.resourceId,
          });
        }
      }
    }
  } catch (error) {
    console.error("Connection rebuild failed:", error);
    return NextResponse.json(
      {
        error: "Connection analysis failed. Existing connections were not changed.",
      },
      { status: 502 }
    );
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const preservedConnections = await db
    .select({ origin: schema.resourceLinks.origin })
    .from(schema.resourceLinks);
  const preservedConnectionCount = preservedConnections.filter(
    (connection) => connection.origin !== "semantic-v2"
  ).length;

  await db.delete(schema.resourceLinks)
    .where(eq(schema.resourceLinks.origin, "semantic-v2"));

  for (const connection of proposedByPair.values()) {
    await db.insert(schema.resourceLinks)
      .values({
        sourceResourceId: connection.sourceResourceId,
        targetResourceId: connection.targetResourceId,
        relationship: connection.relationship,
        reason: connection.reason,
        confidence: Math.round(connection.confidence * 100),
        origin: "semantic-v2",
        createdAt: now,
      });
  }

  return NextResponse.json({
    resourceCount: resources.length,
    connectionCount: preservedConnectionCount + proposedByPair.size,
    generatedConnectionCount: proposedByPair.size,
    preservedLegacyConnections: true,
  });
}
