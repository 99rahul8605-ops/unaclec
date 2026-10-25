import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();
    const progress = db.collection("progress");

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

    const [students, todayUsers, plays, completed, batches, dailyRaw, recent] =
      await Promise.all([
        progress.distinct("userId"),
        progress.distinct("userId", {
          updatedAt: { $gte: todayStart.toISOString() }
        }),
        progress.countDocuments({ seconds: { $gt: 0 } }),
        progress.countDocuments({ completed: true }),
        db
          .collection("batches")
          .find({}, { projection: { _id: 0, published: 1, subjects: 1 } })
          .toArray(),
        progress
          .aggregate([
            { $match: { updatedAt: { $gte: weekStart.toISOString() } } },
            {
              $group: {
                _id: { $substr: ["$updatedAt", 0, 10] },
                users: { $addToSet: "$userId" },
                plays: { $sum: 1 }
              }
            }
          ])
          .toArray(),
        progress
          .aggregate([
            {
              $group: {
                _id: "$userId",
                last: { $max: "$updatedAt" },
                lectures: { $sum: 1 },
                completed: {
                  $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] }
                }
              }
            },
            { $sort: { last: -1 } },
            { $limit: 25 }
          ])
          .toArray()
      ]);

    const lectures = batches.reduce(
      (total, batch) =>
        total +
        (batch.subjects || []).reduce(
          (n, s) => n + (s.lectures?.length || 0),
          0
        ),
      0
    );

    const byDay = new Map(dailyRaw.map((d) => [d._id, d]));
    const daily = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart.getTime() + i * 86400000)
        .toISOString()
        .slice(0, 10);
      const row = byDay.get(day);
      daily.push({
        day,
        users: row ? row.users.length : 0,
        plays: row ? row.plays : 0
      });
    }

    return Response.json(
      {
        todayUsers: todayUsers.length,
        totalStudents: students.length,
        videoPlays: plays,
        completed,
        totalBatches: batches.length,
        activeBatches: batches.filter((b) => b.published).length,
        totalLectures: lectures,
        daily,
        recentStudents: recent.map((r) => ({
          userId: r._id,
          last: r.last,
          lectures: r.lectures,
          completed: r.completed
        }))
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("ADMIN_STATS_FAILED", error);
    return Response.json(
      { error: "Unable to load stats (check MONGODB_URI)." },
      { status: 503 }
    );
  }
}
