import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, isNull } from "drizzle-orm";
import {
  canonicalResourcePair,
  isPlaceholderTopic,
} from "@/lib/graph/connections";

export async function GET() {
  const db = await getDb();

  const allResources = await db
    .select()
    .from(schema.resources)
    .where(isNull(schema.resources.archivedAt));
  const allResourceTopics = await db.select().from(schema.resourceTopics);
  const allTopics = await db.select().from(schema.topics);
  const allResourceLinks = await db.select().from(schema.resourceLinks);
  const allPositions = await db.select().from(schema.graphPositions);

  const posMap = new Map(allPositions.map((p) => [p.nodeId, { x: p.x, y: p.y }]));
  const topicNameMap = new Map(
    allTopics
      .filter((topic) => !isPlaceholderTopic(topic.name))
      .map((topic) => [topic.id, topic.name])
  );

  const topicsByResource = new Map<string, string[]>();
  for (const rt of allResourceTopics) {
    const arr = topicsByResource.get(rt.resourceId) || [];
    const name = topicNameMap.get(rt.topicId);
    if (name) arr.push(name);
    topicsByResource.set(rt.resourceId, arr);
  }

  const resourceIdSet = new Set(allResources.map((r) => r.id));
  const linksByPair = new Map<string, {
    source: string;
    target: string;
    relationship: string;
    reason: string;
    confidence: number;
    origin: string;
    directed: boolean;
  }>();

  for (const link of allResourceLinks) {
    if (
      link.sourceResourceId === link.targetResourceId ||
      !resourceIdSet.has(link.sourceResourceId) ||
      !resourceIdSet.has(link.targetResourceId)
    ) {
      continue;
    }

    const [pairSource, pairTarget] = canonicalResourcePair(
      link.sourceResourceId,
      link.targetResourceId
    );
    const key = `${pairSource}->${pairTarget}`;
    const candidate = {
      source: link.sourceResourceId,
      target: link.targetResourceId,
      relationship: link.relationship,
      reason: link.reason,
      confidence: Math.max(0, Math.min(1, link.confidence / 100)),
      origin: link.origin,
      directed: ["builds_on", "applies", "source_reference"].includes(
        link.relationship
      ),
    };
    const existing = linksByPair.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      linksByPair.set(key, candidate);
    }
  }
  const links = Array.from(linksByPair.values());

  const nodes = allResources.map((r) => ({
    id: r.id,
    name: r.title,
    url: r.url,
    type: r.type,
    source: r.source,
    thumbnail: r.thumbnail,
    summary: r.summary,
    savedAt: r.savedAt,
    author: r.author,
    topics: topicsByResource.get(r.id) || [],
    ...(posMap.get(r.id) || {}),
  }));

  return NextResponse.json({ nodes, links });
}

export async function POST(request: Request) {
  const body = await request.json() as { positions?: { nodeId?: string; x: number; y: number }[] };
  const { positions } = body;

  if (!Array.isArray(positions)) {
    return NextResponse.json({ error: "positions array required" }, { status: 400 });
  }

  const db = await getDb();
  for (const pos of positions) {
    const nodeId = pos.nodeId;
    if (!nodeId) continue;

    const existing = await db
      .select()
      .from(schema.graphPositions)
      .where(eq(schema.graphPositions.nodeId, nodeId))
      .get();

    if (existing) {
      await db.update(schema.graphPositions)
        .set({ x: Math.round(pos.x), y: Math.round(pos.y) })
        .where(eq(schema.graphPositions.nodeId, nodeId));
    } else {
      await db.insert(schema.graphPositions)
        .values({
          nodeId,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        });
    }
  }

  return NextResponse.json({ ok: true });
}
