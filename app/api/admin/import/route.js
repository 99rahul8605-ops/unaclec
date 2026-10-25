import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/admin-auth";
import { parseBatch } from "../../../../lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !payload ||
    !Array.isArray(payload.batches) ||
    payload.batches.length === 0 ||
    payload.batches.length > 30
  ) {
    return Response.json(
      { error: "Expected { batches: [...] } with 1 to 30 batches" },
      { status: 400 }
    );
  }

  let batches;
  try {
    batches = payload.batches.map(parseBatch);
  } catch (error) {
    return Response.json(
      { error: `Invalid catalog: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();
    const collection = db.collection("batches");

    for (const batch of batches) {
      await collection.updateOne(
        { id: batch.id },
        { $set: batch },
        { upsert: true }
      );
    }

    return Response.json({
      ok: true,
      imported: batches.length,
      batches: batches.map((b) => ({
        id: b.id,
        name: b.name,
        subjects: b.subjects.length,
        lectures: b.subjects.reduce((n, s) => n + s.lectures.length, 0)
      }))
    });
  } catch (error) {
    console.error("ADMIN_IMPORT_FAILED", error);
    return Response.json({ error: "Database import failed" }, { status: 503 });
  }
}
