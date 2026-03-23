import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  listAssignedContractorIds,
  listAssignedManagerIds,
  replaceAssignedContractors,
  replaceAssignedManagers,
} from "@/lib/contractor-partners"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "CONTRACTOR" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (session.user.role === "MANAGER") {
    const selectedContractorIds = await listAssignedContractorIds(session.user.id)

    const contractors = selectedContractorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: selectedContractorIds }, role: "CONTRACTOR" },
          select: { id: true, name: true, workspaceId: true },
          orderBy: { name: "asc" },
        })
      : []

    return NextResponse.json({ contractors, selectedContractorIds })
  }

  const selectedManagerIds = await listAssignedManagerIds(session.user.id)

  const managers = selectedManagerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: selectedManagerIds }, role: "MANAGER" },
        select: { id: true, name: true, workspaceId: true },
        orderBy: { name: "asc" },
      })
    : []

  return NextResponse.json({
    managers,
    selectedManagerIds,
  })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  if (session.user.role === "CONTRACTOR") {
    const managerIdsRaw: unknown[] = Array.isArray(body?.managerIds) ? body.managerIds : []
    const managerIds = Array.from(
      new Set(
        managerIdsRaw.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      )
    )

    if (managerIds.length > 0) {
      const existingManagers = await prisma.user.findMany({
        where: { id: { in: managerIds }, role: "MANAGER" },
        select: { id: true },
      })

      if (existingManagers.length !== managerIds.length) {
        return NextResponse.json({ error: "Invalid manager selection" }, { status: 400 })
      }
    }

    await replaceAssignedManagers(session.user.id, managerIds)
    return NextResponse.json({ ok: true })
  }

  if (session.user.role === "MANAGER") {
    const contractorIdsRaw: unknown[] = Array.isArray(body?.contractorIds) ? body.contractorIds : []
    const contractorIds = Array.from(
      new Set(
        contractorIdsRaw.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      )
    )

    if (contractorIds.length > 0) {
      const existingContractors = await prisma.user.findMany({
        where: { id: { in: contractorIds }, role: "CONTRACTOR" },
        select: { id: true },
      })

      if (existingContractors.length !== contractorIds.length) {
        return NextResponse.json({ error: "Invalid contractor selection" }, { status: 400 })
      }
    }

    await replaceAssignedContractors(session.user.id, contractorIds)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "CONTRACTOR" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const workspaceCode = typeof body?.workspaceCode === "string" ? body.workspaceCode.trim().toUpperCase() : ""

  if (!workspaceCode) {
    return NextResponse.json({ error: "workspaceCode is required" }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { code: workspaceCode },
    select: { id: true, managerId: true },
  })

  if (!workspace) {
    return NextResponse.json({ error: "Invalid workspace code" }, { status: 404 })
  }

  if (session.user.role === "CONTRACTOR") {
    const existingIds = await listAssignedManagerIds(session.user.id)
    if (!existingIds.includes(workspace.managerId)) {
      await replaceAssignedManagers(session.user.id, [...existingIds, workspace.managerId])
    }

    return NextResponse.json({ ok: true, managerId: workspace.managerId })
  }

  const workspaceContractors = await prisma.user.findMany({
    where: { role: "CONTRACTOR", workspaceId: workspace.id },
    select: { id: true },
  })

  if (workspaceContractors.length === 0) {
    return NextResponse.json({ error: "No contractors found for this workspace code" }, { status: 404 })
  }

  const existingContractorIds = await listAssignedContractorIds(session.user.id)
  const mergedContractorIds = Array.from(new Set([
    ...existingContractorIds,
    ...workspaceContractors.map((entry) => entry.id),
  ]))

  await replaceAssignedContractors(session.user.id, mergedContractorIds)

  return NextResponse.json({ ok: true, contractorCount: workspaceContractors.length })
}
