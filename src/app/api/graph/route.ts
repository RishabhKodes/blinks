import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { writeGraphJson, writeIndexFile, ensureVaultStructure } from "@/lib/vault";
import type { GraphData } from "@/lib/vault";

// GET /api/graph -- topics as nodes, topic_links as edges
export async function GET() {
  const db = getDb();

  const allTopics = db.select().from(schema.topics).all();
  const allTopicLinks = db.select().from(schema.topicLinks).all();
  const allPositions = db.select().from(schema.graphPositions).all();
  const allResourceTopics = db.select().from(schema.resourceTopics).all();

  const posMap = new Map(allPositions.map((p) => [p.topicId, { x: p.x, y: p.y }]));

  // Count resources per topic
  const resourceCountMap = new Map<string, number>();
  for (const rt of allResourceTopics) {
    resourceCountMap.set(rt.topicId, (resourceCountMap.get(rt.topicId) || 0) + 1);
  }

  // Deduplicate links
  const linkSet = new Set<string>();
  const links: { source: string; target: string }[] = [];
  for (const link of allTopicLinks) {
    const key = [link.sourceTopicId, link.targetTopicId].sort().join("->");
    if (!linkSet.has(key)) {
      linkSet.add(key);
      links.push({ source: link.sourceTopicId, target: link.targetTopicId });
    }
  }

  const graphData: GraphData = {
    nodes: allTopics.map((t) => ({
      id: t.id,
      name: t.name,
      resourceCount: resourceCountMap.get(t.id) || 0,
      ...(posMap.get(t.id) || {}),
    })),
    links,
  };

  // Write graph files to vault
  ensureVaultStructure();
  writeGraphJson(graphData);
  writeIndexFile({
    total_topics: allTopics.length,
    total_resources: allResourceTopics.length,
    last_updated: new Date().toISOString(),
    topicTree: allTopics.map((t) => ({
      name: t.name,
      resourceCount: resourceCountMap.get(t.id) || 0,
      backlinks: allTopicLinks
        .filter((l) => l.sourceTopicId === t.id)
        .map((l) => {
          const target = allTopics.find((tt) => tt.id === l.targetTopicId);
          return target ? `[[${target.name}]]` : "";
        })
        .filter(Boolean),
    })),
  });

  return NextResponse.json(graphData);
}

// POST /api/graph -- save node positions (nodeId = topic ID)
export async function POST(request: Request) {
  const body = await request.json();
  const { positions } = body;

  if (!Array.isArray(positions)) {
    return NextResponse.json({ error: "positions array required" }, { status: 400 });
  }

  const db = getDb();
  for (const pos of positions) {
    const nodeId = pos.topicId || pos.nodeId;
    if (!nodeId) continue;

    const existing = db
      .select()
      .from(schema.graphPositions)
      .where(eq(schema.graphPositions.topicId, nodeId))
      .get();

    if (existing) {
      db.update(schema.graphPositions)
        .set({ x: Math.round(pos.x), y: Math.round(pos.y) })
        .where(eq(schema.graphPositions.topicId, nodeId))
        .run();
    } else {
      db.insert(schema.graphPositions)
        .values({
          topicId: nodeId,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        })
        .run();
    }
  }

  return NextResponse.json({ ok: true });
}
