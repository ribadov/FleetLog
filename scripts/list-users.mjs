import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const workspaceRoot = process.cwd();
const envPath = path.join(workspaceRoot, ".env");
const envLocalPath = path.join(workspaceRoot, ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, companyName: true },
  });

  console.log("Users:");
  for (const user of users) {
    console.log(
      `- ${user.id} | ${user.name} | role=${user.role} | company=${user.companyName ?? "-"} | email=${user.email}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
