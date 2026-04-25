import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  slugify,
  writeTopicFile,
  ensureVaultStructure,
} from "@/lib/vault";

// GET /api/topics -- list all topics
export async function GET() {
  const db = getDb();
  const allTopics = db.select().from(schema.topics).all();
  return NextResponse.json(allTopics);
}

// POST /api/topics -- create a new topic
export async function POST(request: Request) {
  const body = await request.json();
  const { name, description = "", backlinks = [] } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const id = slugify(name);
  const now = new Date().toISOString();
  const db = getDb();

  // Check if already exists
  const existing = db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, id))
    .get();
  if (existing) {
    return NextResponse.json(existing);
  }

  // Insert into SQLite
  db.insert(schema.topics)
    .values({ id, name, description, createdAt: now, updatedAt: now })
    .run();

  // Insert backlinks into topic_links
  for (const targetName of backlinks) {
    const targetId = slugify(targetName.replace(/\[\[|\]\]/g, ""));
    const targetExists = db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.id, targetId))
      .get();
    if (targetExists) {
      db.insert(schema.topicLinks)
        .values({ sourceTopicId: id, targetTopicId: targetId })
        .run();
      // Bidirectional
      db.insert(schema.topicLinks)
        .values({ sourceTopicId: targetId, targetTopicId: id })
        .run();
    }
  }

  // Write markdown file
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

  const created = db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, id))
    .get();
  return NextResponse.json(created, { status: 201 });
}
