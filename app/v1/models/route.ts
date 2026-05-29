import { asc, eq } from "drizzle-orm";
import { authenticateRelayKey } from "@/lib/auth/relay-key";
import { getDb } from "@/lib/db/client";
import { modelAliases, modelMappings } from "@/lib/db/schema";
import { jsonError } from "@/lib/internal/errors";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    await authenticateRelayKey(request);
    const db = getDb();
    const [models, aliases] = await Promise.all([
      db
        .select({ id: modelMappings.publicModelName })
        .from(modelMappings)
        .where(eq(modelMappings.enabled, true))
        .orderBy(asc(modelMappings.publicModelName)),
      db
        .select({ id: modelAliases.alias })
        .from(modelAliases)
        .where(eq(modelAliases.enabled, true))
        .orderBy(asc(modelAliases.alias)),
    ]);

    const created = Math.floor(Date.now() / 1000);
    const data = [...aliases, ...models].map((model) => ({
      id: model.id,
      object: "model",
      created,
      owned_by: "relay",
    }));
    return Response.json({ object: "list", data });
  } catch (error) {
    return jsonError(error);
  }
}
