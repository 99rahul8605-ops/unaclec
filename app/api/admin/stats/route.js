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
    const users = db.collection("users");

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

    const [
      progressUsers,
      knownUsers,
      todayProgress,
      todaySeen,
      plays,
      completed,
      batches,
      dailyRaw,
      recent,
      recentUsers
    ] = await Promise.all([
      progress.distinct("userId"),
      users.distinct("userId"),
      progress.distinct("userId", {
        updatedAt: { $gte: todayStart.toISOString() }
      }),
      users.distinct("userId", {
        lastSeen: { $gte: todayStart.toISOString() }
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
          { $limit: 50 }
        ])
        .toArray(),
      users
        .find({}, { projection: { _id: 0 } })
        .sort({ lastSeen: -1 })
        .limit(50)
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

    // Merge activity (progress) with profile (users) per student.
    const map = new Map();
    for (const u of recentUsers) {
      map.set(u.userId, {
        userId: u.userId,
        name: u.firstName || "",
        username: u.username || "",
        last: u.lastSeen || "",
        lectures: 0,
        completed: 0
      });
    }
    for (const r of recent) {
      const row = map.get(r._id) || {
        userId: r._id,
        name: "",
        username: "",
        last: "",
        lectures: 0,
        completed: 0
      };
      row.lectures = r.lectures;
      row.completed = r.completed;
      if (!row.last || r.last > row.last) row.last = r.last;
      map.set(r._id, row);
    }

    // Names for students seen only in progress (older than this update).
    const missing = [...map.values()]
      .filter((r) => !r.name)
      .map((r) => r.userId);
    if (missing.length) {
      const found = await users
        .find({ userId: { $in: missing } }, { projection: { _id: 0 } })
        .toArray();
      for (const u of found) {
        const row = map.get(u.userId);
        if (row) {
          row.name = u.firstName || "";
          row.username = u.username || "";
        }
      }
    }

    const recentStudents = [...map.values()]
      .sort((a, b) => String(b.last).localeCompare(String(a.last)))
      .slice(0, 50);

    const allStudents = new Set([...progressUsers, ...knownUsers]);
    const activeToday = new Set([...todayProgress, ...todaySeen]);

    return Response.json(
      {
        todayUsers: activeToday.size,
        totalStudents: allStudents.size,
        videoPlays: plays,
        completed,
        totalBatches: batches.length,
        activeBatches: batches.filter((b) => b.published).length,
        totalLectures: lectures,
        daily,
        recentStudents
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
