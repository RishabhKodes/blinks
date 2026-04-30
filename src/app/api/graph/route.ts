import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, isNull } from "drizzle-orm";

// GET /api/graph -- resources as nodes, shared-topic edges
export async function GET() {
  const db = getDb();

  // Only show non-archived resources in the graph
  const allResources = db
    .select()
    .from(schema.resources)
    .where(isNull(schema.resources.archivedAt))
    .all();
  const allResourceTopics = db.select().from(schema.resourceTopics).all();
  const allTopics = db.select().from(schema.topics).all();
  const allPositions = db.select().from(schema.graphPositions).all();

  const posMap = new Map(allPositions.map((p) => [p.nodeId, { x: p.x, y: p.y }]));
  const topicNameMap = new Map(allTopics.map((t) => [t.id, t.name]));

  // Build topics-per-resource map
  const topicsByResource = new Map<string, string[]>();
  for (const rt of allResourceTopics) {
    const arr = topicsByResource.get(rt.resourceId) || [];
    const name = topicNameMap.get(rt.topicId);
    if (name) arr.push(name);
    topicsByResource.set(rt.resourceId, arr);
  }

  // Build edges from shared topics (resources sharing 2+ topics get connected)
  const resourceIdSet = new Set(allResources.map((r) => r.id));
  const linkSet = new Set<string>();
  const links: { source: string; target: string }[] = [];

  if (allResources.length > 1) {
    const topicToResources = new Map<string, string[]>();
    for (const rt of allResourceTopics) {
      if (!resourceIdSet.has(rt.resourceId)) continue;
      const arr = topicToResources.get(rt.topicId) || [];
      arr.push(rt.resourceId);
      topicToResources.set(rt.topicId, arr);
    }
    const pairWeight = new Map<string, number>();
    for (const ids of topicToResources.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join("->");
          pairWeight.set(key, (pairWeight.get(key) || 0) + 1);
        }
      }
    }
    for (const [key, weight] of pairWeight) {
      if (weight >= 2 && !linkSet.has(key)) {
        linkSet.add(key);
        const [a, b] = key.split("->");
        links.push({ source: a!, target: b! });
      }
    }
  }

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

// POST /api/graph -- save node positions
export async function POST(request: Request) {
  const body = await request.json();
  const { positions } = body;

  if (!Array.isArray(positions)) {
    return NextResponse.json({ error: "positions array required" }, { status: 400 });
  }

  const db = getDb();
  for (const pos of positions) {
    const nodeId = pos.nodeId;
    if (!nodeId) continue;

    const existing = db
      .select()
      .from(schema.graphPositions)
      .where(eq(schema.graphPositions.nodeId, nodeId))
      .get();

    if (existing) {
      db.update(schema.graphPositions)
        .set({ x: Math.round(pos.x), y: Math.round(pos.y) })
        .where(eq(schema.graphPositions.nodeId, nodeId))
        .run();
    } else {
      db.insert(schema.graphPositions)
        .values({
          nodeId,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        })
        .run();
    }
  }

  return NextResponse.json({ ok: true });
}
