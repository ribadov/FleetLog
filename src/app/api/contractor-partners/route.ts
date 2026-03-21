import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  listAssignedContractorIds,
  listAssignedManagerIds,
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
    const contractorIds = await listAssignedContractorIds(session.user.id)
    const contractors = contractorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: contractorIds }, role: "CONTRACTOR" },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : []

    return NextResponse.json({ contractors })
  }

  const [managers, selectedManagerIds] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MANAGER" },
      select: { id: true, name: true, workspaceId: true },
      orderBy: { name: "asc" },
    }),
    listAssignedManagerIds(session.user.id),
  ])

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

  if (session.user.role !== "CONTRACTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
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

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "CONTRACTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const workspaceCode = typeof body?.workspaceCode === "string" ? body.workspaceCode.trim().toUpperCase() : ""

  if (!workspaceCode) {
    return NextResponse.json({ error: "workspaceCode is required" }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { code: workspaceCode },
    select: { managerId: true },
  })

  if (!workspace) {
    return NextResponse.json({ error: "Invalid workspace code" }, { status: 404 })
  }

  const existingIds = await listAssignedManagerIds(session.user.id)
  if (!existingIds.includes(workspace.managerId)) {
    await replaceAssignedManagers(session.user.id, [...existingIds, workspace.managerId])
  }

  return NextResponse.json({ ok: true, managerId: workspace.managerId })
}
