import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[a-zA-Z0-9_-]{1,120}$/;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();
    const docs = await db
      .collection("batches")
      .find({}, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();

    const batches = docs.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description || "",
      published: b.published === true,
      updatedAt: b.updatedAt || "",
      subjects: (b.subjects || []).length,
      lectures: (b.subjects || []).reduce(
        (n, s) => n + (s.lectures?.length || 0),
        0
      ),
      withStreamUrl: (b.subjects || []).reduce(
        (n, s) => n + (s.lectures || []).filter((l) => l.stream_url).length,
        0
      )
    }));

    return Response.json({ batches }, { headers: NO_STORE });
  } catch (error) {
    console.error("ADMIN_BATCHES_FAILED", error);
    return Response.json(
      { error: "Unable to load batches (check MONGODB_URI)." },
      { status: 503 }
    );
  }
}

export async function PATCH(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!ID.test(String(body?.id ?? "")) || typeof body.published !== "boolean") {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await db.collection("batches").updateOne(
      { id: body.id },
      { $set: { published: body.published, updatedAt: new Date().toISOString() } }
    );

    if (!result.matchedCount) {
      return Response.json({ error: "Batch not found" }, { status: 404 });
    }
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("ADMIN_BATCH_UPDATE_FAILED", error);
    return Response.json({ error: "Update failed" }, { status: 503 });
  }
}

export async function DELETE(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID.test(id)) {
    return Response.json({ error: "Invalid batch id" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await db.collection("batches").deleteOne({ id });

    if (!result.deletedCount) {
      return Response.json({ error: "Batch not found" }, { status: 404 });
    }
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("ADMIN_BATCH_DELETE_FAILED", error);
    return Response.json({ error: "Delete failed" }, { status: 503 });
  }
}
