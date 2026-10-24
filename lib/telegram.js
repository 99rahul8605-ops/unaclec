
import crypto from "node:crypto";

export function verifyTelegram(request) {
  const token = process.env.BOT_TOKEN;
  const raw = request.headers.get(
    "x-telegram-init-data"
  );

  if (!token || !raw || raw.length > 16000) {
    return null;
  }

  try {
    const params = new URLSearchParams(raw);
    const hash = params.get("hash");

    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return null;
    }

    const authDate = Number(
      params.get("auth_date")
    );

    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(authDate) ||
      authDate > now + 60 ||
      now - authDate > 86400
    ) {
      return null;
    }

    const checkString = [...params.entries()]
      .filter(
        ([key]) =>
          key !== "hash" && key !== "signature"
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    const expected = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest();

    const actual = Buffer.from(hash, "hex");

    if (
      actual.length !== expected.length ||
      !crypto.timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    const user = JSON.parse(
      params.get("user") || "null"
    );

    if (!user || !Number.isSafeInteger(user.id)) {
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
