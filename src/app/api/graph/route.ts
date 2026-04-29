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

  // Build edges weighted by number of shared topics
  // Only show edges where resources share 2+ topics (strong connections)
  // For isolated nodes, add their single best connection so nothing floats alone
  const resourceIds = new Set(allResources.map((r) => r.id));
  const topicSetsById = new Map<string, Set<string>>();
  for (const rt of allResourceTopics) {
    if (!resourceIds.has(rt.resourceId)) continue;
    const s = topicSetsById.get(rt.resourceId) || new Set<string>();
    s.add(rt.topicId);
    topicSetsById.set(rt.resourceId, s);
  }

  // Count shared topics between each pair
  const pairWeight = new Map<string, number>();
  const idList = [...topicSetsById.keys()];
  for (let i = 0; i < idList.length; i++) {
    const aTopics = topicSetsById.get(idList[i]!)!;
    for (let j = i + 1; j < idList.length; j++) {
      const bTopics = topicSetsById.get(idList[j]!)!;
      let shared = 0;
      for (const t of aTopics) {
        if (bTopics.has(t)) shared++;
      }
      if (shared > 0) {
        const key = [idList[i], idList[j]].sort().join("->");
        pairWeight.set(key, shared);
      }
    }
  }

  const linkSet = new Set<string>();
  const links: { source: string; target: string }[] = [];
  const connectedNodes = new Set<string>();

  // Add strong connections (2+ shared topics)
  for (const [key, weight] of pairWeight) {
    if (weight >= 2) {
      linkSet.add(key);
      const [a, b] = key.split("->");
      links.push({ source: a!, target: b! });
      connectedNodes.add(a!);
      connectedNodes.add(b!);
    }
  }

  // For isolated nodes, add their single strongest connection
  for (const id of resourceIds) {
    if (connectedNodes.has(id)) continue;
    let bestKey = "";
    let bestWeight = 0;
    for (const [key, weight] of pairWeight) {
      if ((key.startsWith(id + "->") || key.endsWith("->" + id)) && weight > bestWeight) {
        bestWeight = weight;
        bestKey = key;
      }
    }
    if (bestKey && !linkSet.has(bestKey)) {
      linkSet.add(bestKey);
      const [a, b] = bestKey.split("->");
      links.push({ source: a!, target: b! });
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
