import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { relayApiKeys, type RelayApiKey } from "@/lib/db/schema";
import { hashRelayKey } from "@/lib/crypto/hash";
import { RelayError } from "@/lib/internal/errors";

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function authenticateRelayKey(request: Request | NextRequest): Promise<RelayApiKey> {
  const rawKey = extractBearer(request.headers.get("authorization")) ?? request.headers.get("x-api-key");
  if (!rawKey) {
    throw new RelayError({
      type: "authentication_error",
      message: "Relay API key is required",
      status: 401,
    });
  }

  const db = getDb();
  const [record] = await db
    .select()
    .from(relayApiKeys)
    .where(eq(relayApiKeys.keyHash, hashRelayKey(rawKey)))
    .limit(1);

  if (!record || !record.enabled) {
    throw new RelayError({
      type: "authentication_error",
      message: "Invalid or disabled Relay API key",
      status: 401,
    });
  }

  await db.update(relayApiKeys).set({ lastUsedAt: new Date() }).where(eq(relayApiKeys.id, record.id));
  return record;
}
