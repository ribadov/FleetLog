import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const ADMIN_EMAIL = "info@karr-logistik.com";

const workspaceRoot = process.cwd();
const envPath = path.join(workspaceRoot, ".env");
const envLocalPath = path.join(workspaceRoot, ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

function readPasswordArg() {
  const args = process.argv.slice(2);
  const password = args[0];

  if (!password || password.trim().length < 8) {
    console.error("Usage: npm run admin:set-password -- <password>");
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  return password.trim();
}

async function main() {
  const password = readPasswordArg();
  const prisma = new PrismaClient();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        name: "KARR Administrator",
        role: "ADMIN",
        password: hashedPassword,
        workspaceId: null,
      },
      create: {
        name: "KARR Administrator",
        email: ADMIN_EMAIL,
        role: "ADMIN",
        password: hashedPassword,
        workspaceId: null,
      },
    });

    console.log(`Admin login updated: ${ADMIN_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
