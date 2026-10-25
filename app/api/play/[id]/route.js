
import crypto from "node:crypto";

import { getDb } from "../../../../lib/mongodb";
import { checkForceJoin } from "../../../../lib/forcejoin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyTelegram(initData) {
  if (typeof initData !== "string" || !initData) {
    return null;
  }

  const token = process.env.BOT_TOKEN;
  if (!token) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));

  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    !Number.isSafeInteger(authDate) ||
    authDate > now + 300 ||
    now - authDate > 86400
  ) {
    return null;
  }

  const checkString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(token)
    .digest();

  const expected = crypto
    .createHmac("sha256", secret)
    .update(checkString)
    .digest();

  const received = Buffer.from(hash, "hex");

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return null;
  }

  try {
    const user = JSON.parse(params.get("user") || "{}");
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

// Public diagnostic: confirms the API route exists.
// It does not expose video URLs or secrets.
export async function GET() {
  return json({
    ok: true,
    service: "lecture-playback",
    message: "Use authenticated POST for playback"
  });
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;

    if (
      typeof id !== "string" ||
      !/^[a-z0-9-]{1,100}$/.test(id)
    ) {
      return json(
        { error: "Invalid lecture ID" },
        400
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json(
        { error: "Invalid request JSON" },
        400
      );
    }

    const user = verifyTelegram(body?.initData);

    if (!user) {
      return json(
        { error: "Telegram authentication required" },
        401
      );
    }

    try {
      const db = await getDb();
      const gate = await checkForceJoin(db, user.id);
      if (!gate.ok) {
        return Response.json(
          { error: "Join the required channels to watch lectures.", joinRequired: true },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error("FORCE_JOIN_CHECK_FAILED", error);
    }

    const origin = (
      process.env.STREAM_ORIGIN || ""
    ).replace(/\/+$/, "");

    const secret = process.env.PLAYBACK_SECRET || "";

    if (
      !origin.startsWith("https://") ||
      secret.length < 32
    ) {
      return json(
        { error: "Playback environment not configured" },
        503
      );
    }

    const expiry = Math.floor(Date.now() / 1000) + 3600;

    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${id}.${expiry}`)
      .digest("hex");

    const url =
      `${origin}/video/${encodeURIComponent(id)}` +
      `?exp=${expiry}&sig=${signature}`;


    const ticketExpiry = Math.floor(Date.now() / 1000) + 90;

    const sessionPayload = {
      uid: String(user.id),
      lecture: id,
      exp: ticketExpiry,
      nonce: crypto.randomBytes(24).toString("hex")
    };

    const encoded = Buffer.from(
      JSON.stringify(sessionPayload)
    ).toString("base64url");

    const ticketSignature = crypto
      .createHmac("sha256", secret)
      .update("session-ticket:" + encoded)
      .digest("hex");

    const ticket = `${encoded}.${ticketSignature}`;

    return json({
      ok: true,
      url,
      expires_at: expiry,
      session_ticket: ticket
    });
  } catch (error) {
    console.error("Playback API error:", error);

    return json(
      { error: "Playback API failed" },
      500
    );
  }
}
