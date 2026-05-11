import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  slugify,
  writeTopicFile,
  ensureVaultStructure,
} from "@/lib/vault";

export async function GET() {
  const db = await getDb();
  const allTopics = await db.select().from(schema.topics);
  return NextResponse.json(allTopics);
}

export async function POST(request: Request) {
  const body = await request.json() as { name?: string; description?: string; backlinks?: string[] };
  const { name, description = "", backlinks = [] } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const id = slugify(name);
  const now = new Date().toISOString();
  const db = await getDb();

  const existing = await db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, id))
    .get();
  if (existing) {
    return NextResponse.json(existing);
  }

  await db.insert(schema.topics)
    .values({ id, name, description, createdAt: now, updatedAt: now });

  for (const targetName of backlinks) {
    const targetId = slugify(targetName.replace(/\[\[|\]\]/g, ""));
    const targetExists = await db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, targetId))
      .get();
    if (targetExists) {
      await db.insert(schema.topicLinks)
        .values({ sourceTopicId: id, targetTopicId: targetId });
      await db.insert(schema.topicLinks)
        .values({ sourceTopicId: targetId, targetTopicId: id });
    }
  }

  ensureVaultStructure();
  writeTopicFile(
    {
      id,
      name,
      description,
      backlinks: backlinks.map((b: string) =>
        b.startsWith("[[") ? b : `[[${b}]]`
      ),
      resource_count: 0,
      created: now,
      updated: now,
    },
    []
  );

  const created = await db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, id))
    .get();
  return NextResponse.json(created, { status: 201 });
}
