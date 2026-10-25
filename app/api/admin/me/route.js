import { verifyTelegram, unauthorized } from "../../../../lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = verifyTelegram(request);
  if (!user) return unauthorized();

  const adminId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminId || !/^\\d+$/.test(adminId)) {
    return Response.json(
      { error: "Admin not configured" },
      { status: 503 }
    );
  }

  if (user.id !== adminId) {
    return Response.json(
      { error: "Access denied" },
      { status: 403 }
    );
  }

  return Response.json({
    ok: true,
    admin: {
      firstName: user.firstName
    }
  });
}
