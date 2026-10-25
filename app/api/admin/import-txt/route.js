import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/admin-auth";
import { parseBatch } from "../../../../lib/catalog";
import { parseTxt } from "../../../../lib/txtimport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { text, dryRun?, published? }  (text = the bot's TXT export)
export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim() || text.length > 5_000_000) {
    return Response.json(
      { error: "TXT file is empty or too large (max 5 MB)." },
      { status: 400 }
    );
  }

  let batches;
  try {
    batches = parseTxt(text).map((b) =>
      parseBatch({ ...b, published: body.published !== false })
    );
  } catch (error) {
    return Response.json({ error: `Invalid TXT: ${error.message}` }, { status: 400 });
  }

  if (batches.length === 0) {
    return Response.json(
      {
        error:
          "No lectures found. The file must contain BATCH:, SUBJECT:, LECTURE: and WATCH_URL: lines."
      },
      { status: 400 }
    );
  }

  const summary = batches.map((b) => ({
    id: b.id,
    name: b.name,
    subjects: b.subjects.length,
    lectures: b.subjects.reduce((n, s) => n + s.lectures.length, 0)
  }));

  if (body.dryRun === true) {
    return Response.json({ ok: true, dryRun: true, batches: summary });
  }

  try {
    const db = await getDb();
    for (const batch of batches) {
      await db
        .collection("batches")
        .updateOne({ id: batch.id }, { $set: batch }, { upsert: true });
    }
    return Response.json({ ok: true, imported: batches.length, batches: summary });
  } catch (error) {
    console.error("ADMIN_IMPORT_TXT_FAILED", error);
    return Response.json({ error: "Database import failed" }, { status: 503 });
  }
}
