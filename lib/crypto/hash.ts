import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

export function createRelayKey(): string {
  return `sk-relay-${randomBytes(32).toString("base64url")}`;
}

export function hashRelayKey(rawKey: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(rawKey).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
