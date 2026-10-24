
import crypto from "node:crypto";

/**
 * Verify Telegram Mini App initData using the
 * same bot token that opened the Mini App.
 *
 * Never trust initDataUnsafe or an arbitrary user ID.
 */
export function verifyTelegram(request) {
  const botToken = process.env.BOT_TOKEN;
  const raw = request.headers.get("x-telegram-init-data");

  if (
    !botToken ||
    !raw ||
    typeof raw !== "string" ||
    raw.length > 16000
  ) {
    return null;
  }

  try {
    const params = new URLSearchParams(raw);

    // Reject ambiguous duplicate fields.
    const keys = [...params.keys()];
    if (new Set(keys).size !== keys.length) {
      return null;
    }

    const hash = params.get("hash");

    if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
      return null;
    }

    const authDate = Number(params.get("auth_date"));
    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(authDate) ||
      authDate <= 0 ||
      authDate > now + 60 ||
      now - authDate > 86400
    ) {
      return null;
    }

    // Bot-token HMAC verification:
    // exclude only "hash".
    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      )
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest();

    const receivedHash = Buffer.from(hash, "hex");

    if (
      receivedHash.length !== expectedHash.length ||
      !crypto.timingSafeEqual(
        receivedHash,
        expectedHash
      )
    ) {
      return null;
    }

    const rawUser = params.get("user");

    if (!rawUser) {
      return null;
    }

    const user = JSON.parse(rawUser);

    if (
      !user ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0
    ) {
      return null;
    }

    return {
      id: String(user.id),
      firstName: String(
        user.first_name || "Student"
      ).slice(0, 100),
      username: String(
        user.username || ""
      ).slice(0, 100)
    };

  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json(
    {
      error: "Please open this app using Telegram."
    },
    { status: 401 }
  );
}
