
import crypto from "node:crypto";
import { getDb } from "../../../lib/mongodb";

export const runtime = "nodejs";

function validKey(request) {
  const expected = process.env.ADMIN_IMPORT_KEY;
  const received = request.headers.get(
    "x-admin-import-key"
  );

  if (
    !expected ||
    expected.length < 24 ||
    !received
  ) {
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function cleanId(value) {
  const id = String(value || "");

  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) {
    throw new Error("Invalid ID.");
  }

  return id;
}

function cleanText(value, max = 200) {
  return String(value || "").slice(0, max);
}

function cleanUrl(value) {
  const url = String(value || "");

  if (!url) return "";

  const parsed = new URL(url);

  if (parsed.protocol !== "https:") {
    throw new Error(
      "Media URLs must use HTTPS."
    );
  }

  if (url.length > 2048) {
    throw new Error("Media URL too long.");
  }

  return url;
}

function parseBatch(input) {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.subjects) ||
    input.subjects.length > 100
  ) {
    throw new Error("Invalid batch.");
  }

  return {
    id: cleanId(input.id),
    name: cleanText(input.name),
    description: cleanText(
      input.description, 500
    ),
    published: input.published === true,
    subjects: input.subjects.map((subject) => {
      if (
        !Array.isArray(subject.lectures) ||
        subject.lectures.length > 1000
      ) {
        throw new Error("Invalid subject.");
      }

      return {
        id: cleanId(subject.id),
        name: cleanText(subject.name),
        lectures: subject.lectures.map(
          (lecture) => ({
            id: cleanId(lecture.id),
            name: cleanText(lecture.name),
            class_number:
              Number(lecture.class_number) || 0,
            duration:
              Number(lecture.duration) || 0,
            stream_url: cleanUrl(
              lecture.stream_url
            ),
            notes_url: cleanUrl(
              lecture.notes_url
            )
          })
        )
      };
    }),
    updatedAt: new Date().toISOString()
  };
}

export async function POST(request) {
  if (!validKey(request)) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const payload = await request.json();

    if (
      !Array.isArray(payload.batches) ||
      payload.batches.length > 30
    ) {
      return Response.json(
        { error: "Invalid import payload." },
        { status: 400 }
      );
    }

    // Validate all batches before writing any.
    const batches = payload.batches.map(
      parseBatch
    );

    const db = await getDb();

    for (const batch of batches) {
      await db.collection("batches").updateOne(
        { id: batch.id },
        { $set: batch },
        { upsert: true }
      );
    }

    return Response.json({
      ok: true,
      imported: batches.length
    });
  } catch (error) {
    console.error("Catalog import:", error);

    return Response.json(
      { error: "Import failed: invalid data or database error." },
      { status: 400 }
    );
  }
}
