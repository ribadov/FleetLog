import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@libsql/client";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function loadMigrations(baseDir) {
  const migrationDirs = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return migrationDirs.map((dirName) => {
    const sqlPath = path.join(baseDir, dirName, "migration.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Missing migration.sql in ${dirName}`);
    }

    const script = fs.readFileSync(sqlPath, "utf8");
    const checksum = crypto.createHash("sha256").update(script).digest("hex");

    return {
      dirName,
      sqlPath,
      script,
      checksum,
    };
  });
}

async function ensurePrismaMigrationsTable(client) {
  await client.execute({
    sql: `
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `,
  });
}

async function getAppliedMigrationNames(client) {
  try {
    const result = await client.execute({
      sql: `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`,
    });

    return new Set(result.rows.map((row) => String(row.migration_name)));
  } catch {
    return new Set();
  }
}

async function markMigrationApplied(client, migrationName, checksum) {
  await client.execute({
    sql: `
      INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
    `,
    args: [crypto.randomUUID(), checksum, nowIso(), migrationName, nowIso()],
  });
}

async function main() {
  const url = requiredEnv("DATABASE_URL");
  const authToken = requiredEnv("DATABASE_AUTH_TOKEN");

  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const migrations = loadMigrations(migrationsDir);

  const client = createClient({ url, authToken });

  await ensurePrismaMigrationsTable(client);
  const applied = await getAppliedMigrationNames(client);

  let executed = 0;

  for (const migration of migrations) {
    if (applied.has(migration.dirName)) {
      console.log(`skip ${migration.dirName}`);
      continue;
    }

    console.log(`apply ${migration.dirName}`);
    await client.batch([
      { sql: "BEGIN" },
      { sql: migration.script },
      {
        sql: `
          INSERT INTO "_prisma_migrations"
            ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
          VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
        `,
        args: [crypto.randomUUID(), migration.checksum, nowIso(), migration.dirName, nowIso()],
      },
      { sql: "COMMIT" },
    ]).catch(async (error) => {
      try {
        await client.execute({ sql: "ROLLBACK" });
      } catch {
      }
      throw new Error(`Migration failed (${migration.dirName}): ${error instanceof Error ? error.message : String(error)}`);
    });

    executed += 1;
  }

  if (executed === 0) {
    console.log("No pending migrations.");
  } else {
    console.log(`Applied ${executed} migration(s).`);
  }

  await client.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
