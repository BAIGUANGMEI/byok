import { createAdminSession, verifyAdminCredentials } from "@/lib/auth/admin-session";
import { getEnv } from "@/lib/env";
import { jsonError, RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

async function parseCredentials(request: Request): Promise<{ email: string; password: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    return { email: body.email ?? "", password: body.password ?? "" };
  }

  const formData = await request.formData().catch(() => null);
  return {
    email: String(formData?.get("email") ?? ""),
    password: String(formData?.get("password") ?? ""),
  };
}

function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function redirectTo(request: Request, path: string): Response {
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const target = host ? `${protocol}://${host}${path}` : new URL(path, request.url).toString();
  return Response.redirect(target, 303);
}

export async function POST(request: Request): Promise<Response> {
  const htmlForm = wantsHtml(request);
  try {
    getEnv();
    const body = await parseCredentials(request);
    if (!verifyAdminCredentials(body.email, body.password)) {
      if (htmlForm) {
        return redirectTo(request, "/login?error=invalid");
      }
      throw new RelayError({
        type: "authentication_error",
        message: "Invalid email or password",
        status: 401,
      });
    }
    await createAdminSession(body.email);
    if (htmlForm) {
      return redirectTo(request, "/dashboard");
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (htmlForm) {
      return redirectTo(request, "/login?error=invalid");
    }
    return jsonError(error);
  }
}
