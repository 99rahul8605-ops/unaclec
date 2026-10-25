import { getDb } from "../../../lib/mongodb";
import {
  verifyTelegram,
  unauthorized
} from "../../../lib/telegram";
import { checkForceJoin } from "../../../lib/forcejoin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = verifyTelegram(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const db = await getDb();

    // Remember who this student is (name shown in the admin dashboard).
    try {
      const now = new Date().toISOString();
      await db.collection("users").updateOne(
        { userId: user.id },
        {
          $set: {
            firstName: user.firstName,
            username: user.username,
            lastSeen: now
          },
          $setOnInsert: { firstSeen: now }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("USER_RECORD_FAILED", error);
    }

    // Force-join: students must be in the required groups/channels.
    const gate = await checkForceJoin(db, user.id);

    if (!gate.ok) {
      return Response.json(
        {
          error: "Please join the required channels to continue.",
          joinRequired: true,
          chats: gate.chats
        },
        { status: 403 }
      );
    }

    const batches = await db
      .collection("batches")
      .find(
        { published: true },
        { projection: { _id: 0 } }
      )
      .sort({ updatedAt: -1 })
      .toArray();

    const progress = await db
      .collection("progress")
      .find(
        { userId: user.id },
        { projection: { _id: 0 } }
      )
      .toArray();

    return Response.json({
      user,
      batches,
      progress
    });
  } catch (error) {
    console.error("Library error:", error);

    return Response.json(
      { error: "Unable to load lecture library." },
      { status: 503 }
    );
  }
}
