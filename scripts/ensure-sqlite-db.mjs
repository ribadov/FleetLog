import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  console.log(`[db:prepare] DATABASE_URL not set, using fallback ${DEFAULT_DATABASE_URL}`);
}

const root = process.cwd();
const target = path.join(root, "prisma", "dev.db");
const fallback = path.join(root, "prisma", "prisma", "dev.db");

function hasData(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

if (!hasData(target) && hasData(fallback)) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(fallback, target);
  console.log(`[db:prepare] Copied fallback DB to ${target}`);
}

if (!hasData(target)) {
  console.log("[db:prepare] Creating sqlite schema via Prisma migrations...");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  });
}

if (!hasData(target)) {
  console.warn("[db:prepare] prisma/dev.db is still empty after migration.");
} else {
  console.log("[db:prepare] prisma/dev.db is ready.");
}
