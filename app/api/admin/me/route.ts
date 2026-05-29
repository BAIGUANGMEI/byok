import { getAdminSession } from "@/lib/auth/admin-session";
import { jsonError } from "@/lib/internal/errors";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    return Response.json({ authenticated: Boolean(session), email: session?.email ?? null });
  } catch (error) {
    return jsonError(error);
  }
}
