
import { getDb } from "../../../lib/mongodb";
import {
  verifyTelegram,
  unauthorized
} from "../../../lib/telegram";

export const runtime = "nodejs";

export async function POST(request) {
  const user = verifyTelegram(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();

    const {
      batchId,
      subjectId,
      lectureId,
      action
    } = body;

    if (
      ![batchId, subjectId, lectureId].every(
        (v) =>
          typeof v === "string" &&
          v.length > 0 &&
          v.length <= 120
      )
    ) {
      return Response.json(
        { error: "Invalid lecture identifiers." },
        { status: 400 }
      );
    }

    const db = await getDb();

    const exists = await db.collection("batches")
      .findOne({
        id: batchId,
        published: true,
        subjects: {
          $elemMatch: {
            id: subjectId,
            lectures: {
              $elemMatch: { id: lectureId }
            }
          }
        }
      }, { projection: { _id: 1 } });

    if (!exists) {
      return Response.json(
        { error: "Lecture not found." },
        { status: 404 }
      );
    }

    const filter = {
      userId: user.id,
      batchId,
      subjectId,
      lectureId
    };

    const update = {
      updatedAt: new Date().toISOString()
    };

    if (action === "notes") {
      if (
        typeof body.notes !== "string" ||
        body.notes.length > 10000
      ) {
        return Response.json(
          { error: "Notes must be under 10000 characters." },
          { status: 400 }
        );
      }

      update.notes = body.notes;
    } else if (action === "watch") {
      const seconds = Number(body.seconds);

      if (
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > 864000
      ) {
        return Response.json(
          { error: "Invalid playback position." },
          { status: 400 }
        );
      }

      update.seconds = Math.floor(seconds);
      update.completed = body.completed === true;
    } else {
      return Response.json(
        { error: "Unknown action." },
        { status: 400 }
      );
    }

    await db.collection("progress").updateOne(
      filter,
      { $set: update },
      { upsert: true }
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Progress error:", error);

    return Response.json(
      { error: "Unable to save progress." },
      { status: 500 }
    );
  }
}
