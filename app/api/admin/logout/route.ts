import { clearAdminSession } from "@/lib/auth/admin-session";
import { jsonError } from "@/lib/internal/errors";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    await clearAdminSession();
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
