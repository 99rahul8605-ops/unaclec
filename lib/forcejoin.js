// Force-join: verify that a student is a member of the required
// Telegram groups/channels. Uses the same BOT_TOKEN as the Mini App.
const API = "https://api.telegram.org";
const GOOD = new Set(["creator", "administrator", "member"]);
const cache = new Map(); // "chatId:userId" -> expiry (members only)
let botIdCache = null;

export async function tg(method, params) {
  const token = process.env.BOT_TOKEN;
  if (!token) return { ok: false, description: "BOT_TOKEN missing" };

  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params || {}),
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    return await res.json();
  } catch {
    return { ok: false, description: "network error" };
  }
}

export async function getSettings(db) {
  const doc = await db.collection("settings").findOne({ _id: "force_join" });
  return {
    enabled: doc?.enabled === true,
    chats: Array.isArray(doc?.chats) ? doc.chats : []
  };
}

export async function saveSettings(db, patch) {
  await db
    .collection("settings")
    .updateOne({ _id: "force_join" }, { $set: patch }, { upsert: true });
}

// "member" | "not_member" | "unknown"
export async function memberStatus(chatId, userId) {
  const key = `${chatId}:${userId}`;
  const hit = cache.get(key);
  if (hit && hit > Date.now()) return "member";

  const r = await tg("getChatMember", {
    chat_id: chatId,
    user_id: Number(userId)
  });

  if (r.ok) {
    const status = r.result?.status;
    const member =
      GOOD.has(status) ||
      (status === "restricted" && r.result?.is_member === true);

    if (member) {
      if (cache.size > 5000) cache.clear();
      cache.set(key, Date.now() + 60_000);
      return "member";
    }
    return "not_member";
  }

  const text = String(r.description || "").toLowerCase();
  if (text.includes("user not found") || text.includes("participant_id_invalid")) {
    return "not_member";
  }

  // Bot removed, chat missing, Telegram outage: do not lock students out.
  console.error("FORCE_JOIN_UNKNOWN", chatId, r.description);
  return "unknown";
}

export function isAdminId(userId) {
  const adminId = String(process.env.ADMIN_TELEGRAM_ID ?? "")
    .replace(/["'\s]/g, "");
  return Boolean(adminId) && String(userId) === adminId;
}

export async function checkForceJoin(db, userId) {
  if (isAdminId(userId)) return { ok: true };

  const settings = await getSettings(db);
  if (!settings.enabled || settings.chats.length === 0) return { ok: true };

  const results = await Promise.all(
    settings.chats.map(async (chat) => ({
      chat,
      status: await memberStatus(chat.chatId, userId)
    }))
  );

  const missing = results
    .filter((r) => r.status === "not_member")
    .map((r) => ({
      title: r.chat.title,
      type: r.chat.type,
      link: r.chat.link || ""
    }));

  return missing.length ? { ok: false, chats: missing } : { ok: true };
}

// Can the bot actually verify members of this chat?
export async function botCanVerify(chatId) {
  if (!botIdCache) {
    const me = await tg("getMe", {});
    if (me.ok) botIdCache = me.result.id;
  }
  if (!botIdCache) return { ok: false, note: "Bot token problem" };

  const r = await tg("getChatMember", {
    chat_id: chatId,
    user_id: botIdCache
  });

  if (!r.ok) {
    return { ok: false, note: "Bot is not in this chat. Add the bot as admin." };
  }

  const status = r.result?.status;
  if (status === "administrator" || status === "creator") {
    return { ok: true, note: "Bot can verify members" };
  }
  return { ok: false, note: "Make the bot an admin of this chat." };
}
