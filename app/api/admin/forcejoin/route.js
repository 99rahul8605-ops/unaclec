import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/admin-auth";
import {
  botCanVerify,
  getSettings,
  saveSettings,
  tg
} from "../../../../lib/forcejoin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_CHATS = 10;
const CHAT_INPUT = /^(-?\d{5,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;
const LINK = /^https:\/\/(t|telegram)\.me\/[A-Za-z0-9_+\/-]{3,120}$/;

function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();
    const settings = await getSettings(db);

    const chats = await Promise.all(
      settings.chats.map(async (chat) => ({
        ...chat,
        bot: await botCanVerify(chat.chatId)
      }))
    );

    return Response.json(
      { enabled: settings.enabled, chats },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("FORCEJOIN_GET_FAILED", error);
    return fail("Unable to load settings (check MONGODB_URI).", 503);
  }
}

// POST { chatId, link? }  -> add a group/channel
export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request");
  }

  const input = String(body?.chatId ?? "").trim();
  const link = String(body?.link ?? "").trim();

  if (!CHAT_INPUT.test(input)) {
    return fail("Enter a group/channel ID like -1001234567890 or @username.");
  }
  if (link && !LINK.test(link)) {
    return fail("Invite link must look like https://t.me/+AbCdEf...");
  }

  const info = await tg("getChat", {
    chat_id: /^-?\d+$/.test(input) ? Number(input) : input
  });

  if (!info.ok) {
    return fail(
      "Telegram could not find this chat. Add the bot to the group/channel as admin first, then try again."
    );
  }

  const chat = info.result;
  if (!["group", "supergroup", "channel"].includes(chat.type)) {
    return fail("Only groups and channels can be used.");
  }

  let finalLink = link;
  if (!finalLink && chat.username) finalLink = `https://t.me/${chat.username}`;
  if (!finalLink) {
    const created = await tg("createChatInviteLink", {
      chat_id: chat.id,
      name: "Lecture App"
    });
    if (created.ok) finalLink = created.result.invite_link;
  }

  try {
    const db = await getDb();
    const settings = await getSettings(db);

    if (settings.chats.some((c) => c.chatId === chat.id)) {
      return fail("This chat is already added.");
    }
    if (settings.chats.length >= MAX_CHATS) {
      return fail(`You can add up to ${MAX_CHATS} chats.`);
    }

    const entry = {
      chatId: chat.id,
      title: String(chat.title || chat.username || chat.id).slice(0, 100),
      type: chat.type,
      link: finalLink
    };

    await saveSettings(db, { chats: [...settings.chats, entry] });

    const bot = await botCanVerify(chat.id);
    return Response.json(
      {
        ok: true,
        chat: { ...entry, bot },
        warning: bot.ok ? "" : bot.note,
        linkMissing: !finalLink
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("FORCEJOIN_ADD_FAILED", error);
    return fail("Could not save.", 503);
  }
}

// PATCH { enabled }
export async function PATCH(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request");
  }

  if (typeof body?.enabled !== "boolean") return fail("Invalid request");

  try {
    const db = await getDb();
    const settings = await getSettings(db);

    if (body.enabled && settings.chats.length === 0) {
      return fail("Add at least one group/channel first.");
    }

    await saveSettings(db, { enabled: body.enabled });
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("FORCEJOIN_TOGGLE_FAILED", error);
    return fail("Could not save.", 503);
  }
}

// DELETE ?chatId=...
export async function DELETE(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const chatId = Number(new URL(request.url).searchParams.get("chatId"));
  if (!Number.isSafeInteger(chatId)) return fail("Invalid chat id");

  try {
    const db = await getDb();
    const settings = await getSettings(db);
    const chats = settings.chats.filter((c) => c.chatId !== chatId);

    await saveSettings(db, {
      chats,
      enabled: chats.length === 0 ? false : settings.enabled
    });
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("FORCEJOIN_DELETE_FAILED", error);
    return fail("Could not save.", 503);
  }
}
