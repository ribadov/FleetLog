import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = session.user.role
  const { isAdmin, workspaceId } = getTenantContext(session.user)

  if (!isAdmin && !workspaceId) {
    return NextResponse.json({ error: "Workspace missing" }, { status: 403 })
  }

  let where: Record<string, unknown> = isAdmin ? {} : { workspaceId }
  if (role === "DRIVER" || role === "CONTRACTOR") {
    where = { ...where, role: "DRIVER" }
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(users)
}
