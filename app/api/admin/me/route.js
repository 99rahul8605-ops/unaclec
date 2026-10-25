import { verifyTelegram, unauthorized } from "../../../../lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = verifyTelegram(request);
  if (!user) return unauthorized();

  const adminId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminId || !/^\\d+$/.test(adminId)) {
    console.error("ADMIN_CONFIGURATION_ERROR", {
      configured: Boolean(adminId),
      numeric: Boolean(adminId && /^\\d+$/.test(adminId)),
      length: adminId?.length || 0
    });

    return Response.json(
      {
        error: !adminId
          ? "ADMIN_TELEGRAM_ID missing in production"
          : "ADMIN_TELEGRAM_ID must contain only digits"
      },
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
