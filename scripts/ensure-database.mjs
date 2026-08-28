import "dotenv/config";
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

console.log("[db:prepare] Applying Prisma migrations...");

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: process.env,
});

console.log("[db:prepare] Database is ready.");