import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as { action?: string };
  const { action } = body;

  if (action !== "archive" && action !== "unarchive") {
    return NextResponse.json(
      { error: "action must be 'archive' or 'unarchive'" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const resource = await db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.id, id))
    .get();

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const archivedAt = action === "archive" ? new Date().toISOString() : null;
  await db.update(schema.resources)
    .set({ archivedAt })
    .where(eq(schema.resources.id, id));

  return NextResponse.json({ ok: true, archivedAt });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  const resource = await db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.id, id))
    .get();

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  await db.delete(schema.resources)
    .where(eq(schema.resources.id, id));

  await db.delete(schema.graphPositions)
    .where(eq(schema.graphPositions.nodeId, id));

  return NextResponse.json({ ok: true });
}
