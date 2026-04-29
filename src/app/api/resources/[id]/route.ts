import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// PATCH /api/resources/[id] -- archive or unarchive a resource
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (action !== "archive" && action !== "unarchive") {
    return NextResponse.json(
      { error: "action must be 'archive' or 'unarchive'" },
      { status: 400 }
    );
  }

  const db = getDb();
  const resource = db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.id, id))
    .get();

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const archivedAt = action === "archive" ? new Date().toISOString() : null;
  db.update(schema.resources)
    .set({ archivedAt })
    .where(eq(schema.resources.id, id))
    .run();

  return NextResponse.json({ ok: true, archivedAt });
}

// DELETE /api/resources/[id] -- permanently delete a resource
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const resource = db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.id, id))
    .get();

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  // Cascade deletes handle resource_topics and resource_links
  db.delete(schema.resources)
    .where(eq(schema.resources.id, id))
    .run();

  // Clean up graph position
  db.delete(schema.graphPositions)
    .where(eq(schema.graphPositions.nodeId, id))
    .run();

  return NextResponse.json({ ok: true });
}
