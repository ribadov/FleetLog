import { prisma } from "@/lib/prisma"

export function hasContractorPartnerModel(): boolean {
  return true
}

export async function listAssignedManagerIds(contractorId: string): Promise<string[]> {
  const rows = await prisma.contractorPartnerAssignment.findMany({
    where: {
      contractorId,
    },
    select: {
      managerId: true,
    },
  })

  return rows.map((row) => row.managerId)
}

export async function listAssignedContractorIds(managerId: string): Promise<string[]> {
  const rows = await prisma.contractorPartnerAssignment.findMany({
    where: {
      managerId,
    },
    select: {
      contractorId: true,
    },
  })

  return rows.map((row) => row.contractorId)
}

export async function isManagerAssignedToContractor(
  contractorId: string,
  managerId: string,
): Promise<boolean> {
  const assignment = await prisma.contractorPartnerAssignment.findUnique({
    where: {
      contractorId_managerId: {
        contractorId,
        managerId,
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(assignment)
}

export async function replaceAssignedManagers(
  contractorId: string,
  managerIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.contractorPartnerAssignment.deleteMany({
      where: {
        contractorId,
      },
    })

    for (const managerId of managerIds) {
      await tx.contractorPartnerAssignment.create({
        data: {
          contractorId,
          managerId,
        },
      })
    }
  })
}

export async function replaceAssignedContractors(
  managerId: string,
  contractorIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.contractorPartnerAssignment.deleteMany({
      where: {
        managerId,
      },
    })

    for (const contractorId of contractorIds) {
      await tx.contractorPartnerAssignment.create({
        data: {
          contractorId,
          managerId,
        },
      })
    }
  })
}