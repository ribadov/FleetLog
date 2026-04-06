import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@libsql/client/http";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }

  const normalized = value.trim();
  const looksLikePlaceholder =
    normalized.includes("<") ||
    normalized.includes(">") ||
    normalized.includes("ECHTE_DB") ||
    normalized.includes("ECHTER_TOKEN") ||
    normalized.includes("deine-db") ||
    normalized.includes("dein-token");

  if (looksLikePlaceholder) {
    throw new Error(`Env var ${name} looks like a placeholder. Please use real production credentials.`);
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

function splitSqlStatements(sqlScript) {
  const statements = [];
  let current = "";
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (index < sqlScript.length) {
    const char = sqlScript[index];
    const nextChar = sqlScript[index + 1];

    if (inLineComment) {
      current += char;
      if (char === "\n") {
        inLineComment = false;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && nextChar === "/") {
        current += nextChar;
        inBlockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "-" && nextChar === "-") {
      current += char + nextChar;
      inLineComment = true;
      index += 2;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "/" && nextChar === "*") {
      current += char + nextChar;
      inBlockComment = true;
      index += 2;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      const escapedQuote = inSingleQuote && nextChar === "'";
      current += char;
      if (escapedQuote) {
        current += nextChar;
        index += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      index += 1;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      const escapedQuote = inDoubleQuote && nextChar === '"';
      current += char;
      if (escapedQuote) {
        current += nextChar;
        index += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
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
  const rawUrl = requiredEnv("DATABASE_URL");
  const authToken = requiredEnv("DATABASE_AUTH_TOKEN");
  const url = rawUrl.startsWith("libsql://")
    ? rawUrl.replace(/^libsql:\/\//, "https://")
    : rawUrl;

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
    const statements = splitSqlStatements(migration.script);
    try {
      for (let statementIndex = 0; statementIndex < statements.length; statementIndex += 1) {
        const statement = statements[statementIndex];
        await client.execute({ sql: statement });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration failed (${migration.dirName}): ${errorMessage}`);
    }

    await markMigrationApplied(client, migration.dirName, migration.checksum);

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
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  if (message.includes("resp.body?.cancel is not a function")) {
    console.error(
      "Transport error while talking to Turso. Verify DATABASE_URL and DATABASE_AUTH_TOKEN are real values (no placeholders), then retry."
    );
  }

  console.error(message);
  if (stack) {
    console.error(stack);
  }
  process.exit(1);
});
