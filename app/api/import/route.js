
import crypto from "node:crypto";
import { getDb } from "../../../lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verify admin import secret safely.
function validKey(request) {
  const expected = process.env.ADMIN_IMPORT_KEY;
  const received = request.headers.get("x-admin-import-key");

  if (!expected || expected.length < 24 || !received) {
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

// Generate safe identifiers.
function cleanId(value) {
  const id = String(value ?? "");

  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) {
    throw new Error(`Invalid ID: ${id.slice(0, 50)}`);
  }

  return id;
}

function cleanText(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

// Only accept HTTPS playback URLs.
// An empty URL is allowed until streaming is configured.
function cleanUrl(value) {
  const url = String(value ?? "").trim();

  if (!url) {
    return "";
  }

  if (url.length > 2048) {
    throw new Error("Media URL too long");
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid media URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Media URL must use HTTPS");
  }

  return url;
}

// Validate one batch and its subjects/lectures.
function parseBatch(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !Array.isArray(input.subjects) ||
    input.subjects.length > 100
  ) {
    throw new Error("Invalid batch structure");
  }

  const batchId = cleanId(input.id);
  const batchName = cleanText(input.name);

  if (!batchName) {
    throw new Error("Batch name missing");
  }

  const subjects = input.subjects.map((subject) => {
    if (
      !subject ||
      typeof subject !== "object" ||
      !Array.isArray(subject.lectures) ||
      subject.lectures.length > 1000
    ) {
      throw new Error("Invalid subject structure");
    }

    const subjectId = cleanId(subject.id);
    const subjectName = cleanText(subject.name);

    if (!subjectName) {
      throw new Error("Subject name missing");
    }

    const lectures = subject.lectures.map((lecture) => {
      if (!lecture || typeof lecture !== "object") {
        throw new Error("Invalid lecture");
      }

      const lectureId = cleanId(lecture.id);
      const lectureName = cleanText(lecture.name);

      if (!lectureName) {
        throw new Error("Lecture name missing");
      }

      const classNumber = Number(lecture.class_number || 0);
      const duration = Number(lecture.duration || 0);

      if (
        !Number.isFinite(classNumber) ||
        !Number.isFinite(duration) ||
        classNumber < 0 ||
        duration < 0
      ) {
        throw new Error("Invalid class number or duration");
      }

      return {
        id: lectureId,
        name: lectureName,
        class_number: classNumber,
        duration,
        stream_url: cleanUrl(lecture.stream_url),
        notes_url: cleanUrl(lecture.notes_url)
      };
    });

    return {
      id: subjectId,
      name: subjectName,
      lectures
    };
  });

  return {
    id: batchId,
    name: batchName,
    description: cleanText(input.description, 500),
    published: input.published === true,
    subjects,
    updatedAt: new Date().toISOString()
  };
}

// POST /api/import
export async function POST(request) {
  if (!validKey(request)) {
    return Response.json(
      { error: "Invalid admin import key" },
      { status: 401 }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  if (
    !payload ||
    !Array.isArray(payload.batches) ||
    payload.batches.length === 0 ||
    payload.batches.length > 30
  ) {
    return Response.json(
      { error: "Expected 1 to 30 batches" },
      { status: 400 }
    );
  }

  let batches;

  try {
    // Validate all data before connecting to MongoDB.
    batches = payload.batches.map(parseBatch);
  } catch (error) {
    console.error("CATALOG_VALIDATION_FAILED", error.message);

    return Response.json(
      {
        error: "Invalid catalog data",
        details: error.message
      },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();
    const collection = db.collection("batches");

    let imported = 0;

    for (const batch of batches) {
      await collection.updateOne(
        { id: batch.id },
        { $set: batch },
        { upsert: true }
      );

      imported++;
    }

    return Response.json(
      {
        ok: true,
        imported,
        batches: batches.map((batch) => ({
          id: batch.id,
          name: batch.name,
          subjects: batch.subjects.length,
          lectures: batch.subjects.reduce(
            (total, subject) =>
              total + subject.lectures.length,
            0
          )
        }))
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("CATALOG_DATABASE_FAILED", {
      name: error.name,
      message: error.message,
      code: error.code
    });

    return Response.json(
      {
        error: "Database import failed",
        type: error.name || "UnknownError",
        details:
          "Check Vercel Runtime Logs for the exact MongoDB error."
      },
      { status: 503 }
    );
  }
}
