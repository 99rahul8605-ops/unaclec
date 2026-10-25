import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secureEqual(a, b) {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request) {
  const secret = process.env.LECTURE_BOT_WEBHOOK_SECRET;
  const token = process.env.LECTURE_BOT_TOKEN;

  if (!secret || !token) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (!secureEqual(
    request.headers.get("x-telegram-bot-api-secret-token"),
    secret
  )) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = (message?.text || "").trim();

  if (!chatId || !/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    return Response.json({ ok: true });
  }

  const reply = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "📚 Welcome to Lecture App!\n\nTap below to open your lectures.",
        reply_markup: {
          inline_keyboard: [[{
            text: "▶️ Open Lecture App",
            web_app: {
              url: "https://app.bingolink.site"
            }
          }]]
        }
      }),
      cache: "no-store"
    }
  );

  if (!reply.ok) {
    console.error("Telegram sendMessage failed", reply.status);
    return Response.json({ error: "Telegram send failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
