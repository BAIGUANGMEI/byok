import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbClient: DbClient | null = null;

export function getDb(): DbClient {
  if (!dbClient) {
    const env = getEnv();
    sqlClient = postgres(env.DATABASE_URL, {
      max: 5,
      prepare: false,
    });
    dbClient = drizzle(sqlClient, { schema });
  }
  return dbClient;
}
