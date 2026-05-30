import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { getEnv } from "../lib/env";

async function loadDotEnv(): Promise<void> {
  const envPath = join(process.cwd(), ".env");
  const content = await readFile(envPath, "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;
    process.env[key] ??= value;
  }
}

await loadDotEnv();

const sql = postgres(getEnv().DATABASE_URL, {
  max: 1,
  prepare: false,
});

try {
  const migrationDir = join(process.cwd(), "drizzle");
  const migrationFiles = (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  for (const file of migrationFiles) {
    const migration = await readFile(join(migrationDir, file), "utf8");
    await sql.unsafe(migration);
  }
  console.log("Migration complete");
} finally {
  await sql.end();
}
