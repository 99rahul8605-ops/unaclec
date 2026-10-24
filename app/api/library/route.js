
import { getDb } from "../../../lib/mongodb";
import {
  verifyTelegram,
  unauthorized
} from "../../../lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = verifyTelegram(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const db = await getDb();

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
