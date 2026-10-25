import { verifyTelegram, unauthorized } from "./telegram";

// Server-side check. Never accept a user ID supplied by the browser.
export function requireAdmin(request) {
  const user = verifyTelegram(request);

  if (!user) {
    return { ok: false, response: unauthorized() };
  }

  const adminId = String(
    process.env.ADMIN_TELEGRAM_ID ?? ""
  )
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

  if (!/^[0-9]+$/.test(adminId)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Admin configuration invalid" },
        { status: 503 }
      )
    };
  }

  if (user.id !== adminId) {
    return {
      ok: false,
      response: Response.json(
        { error: "Access denied: not the admin account" },
        { status: 403 }
      )
    };
  }

  return { ok: true, user };
}
