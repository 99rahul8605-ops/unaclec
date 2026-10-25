import { requireAdmin } from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const result = requireAdmin(request);

  if (!result.ok) return result.response;

  return Response.json(
    {
      ok: true,
      verified: true,
      method: "telegram-signed-init-data",
      admin: {
        firstName: result.user.firstName
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
