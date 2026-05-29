import { requireAdmin } from "@/lib/auth/admin-session";
import { jsonError } from "@/lib/internal/errors";

export async function adminRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    await requireAdmin();
    return await handler();
  } catch (error) {
    return jsonError(error);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return {};
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = typeof value === "string" ? value : value.name;
    }
    return body;
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

export function redirectTo(request: Request, path: string): Response {
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const target = host ? `${protocol}://${host}${path}` : new URL(path, request.url).toString();
  return Response.redirect(target, 303);
}

export function redirectAfterMutation(request: Request, body: Record<string, unknown>, status = "created"): Response {
  const fallback = new URL(request.url).pathname.replace("/api/admin", "/dashboard");
  const path = stringValue(body._redirect) ?? fallback;
  const url = new URL(path, request.url);
  url.searchParams.set("status", status);
  return redirectTo(request, `${url.pathname}${url.search}`);
}

export function boolValue(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

export function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
