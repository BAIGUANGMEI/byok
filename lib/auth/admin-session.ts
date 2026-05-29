import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { RelayError } from "@/lib/internal/errors";

const COOKIE_NAME = "relay_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  email: string;
  exp: number;
};

function sign(value: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(value).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(value: string): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createAdminSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encode({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  return raw ? decode(raw) : null;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    throw new RelayError({
      type: "authentication_error",
      message: "Admin session required",
      status: 401,
    });
  }
  return session;
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const env = getEnv();
  return email === env.ADMIN_EMAIL && password === env.ADMIN_PASSWORD;
}
