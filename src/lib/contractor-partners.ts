import { prisma } from "@/lib/prisma"

export function hasContractorPartnerModel(): boolean {
  return true
}

export async function listAssignedManagerIds(contractorId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ managerId: string }>>`
    SELECT "managerId"
    FROM "ContractorPartnerAssignment"
    WHERE "contractorId" = ${contractorId}
  `

  return rows.map((row) => row.managerId)
}

export async function listAssignedContractorIds(managerId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ contractorId: string }>>`
    SELECT "contractorId"
    FROM "ContractorPartnerAssignment"
    WHERE "managerId" = ${managerId}
  `

  return rows.map((row) => row.contractorId)
}

export async function isManagerAssignedToContractor(contractorId: string, managerId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) as count
    FROM "ContractorPartnerAssignment"
    WHERE "contractorId" = ${contractorId}
      AND "managerId" = ${managerId}
  `

  return Number(rows[0]?.count ?? 0) > 0
}

export async function replaceAssignedManagers(contractorId: string, managerIds: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "ContractorPartnerAssignment"
      WHERE "contractorId" = ${contractorId}
    `

    for (const managerId of managerIds) {
      await tx.$executeRaw`
        INSERT OR IGNORE INTO "ContractorPartnerAssignment" ("id", "contractorId", "managerId", "createdAt")
        VALUES (lower(hex(randomblob(12))), ${contractorId}, ${managerId}, CURRENT_TIMESTAMP)
      `
    }
  })
}
