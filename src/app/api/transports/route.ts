import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storePlaceIfPossible } from "@/lib/places"
import { getTenantContext } from "@/lib/tenant"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const driverIdFilter = searchParams.get("driverId")
  const { isAdmin, workspaceId } = getTenantContext(session.user)

  if (!isAdmin && !workspaceId) {
    return NextResponse.json({ error: "Workspace missing" }, { status: 403 })
  }

  let where: Record<string, unknown> = {}
  if (!isAdmin) {
    where = { ...where, workspaceId }
  }

  if (session.user.role === "DRIVER") {
    where = { ...where, driverId: session.user.id }
  } else if (driverIdFilter && session.user.role === "MANAGER") {
    where = { ...where, driverId: driverIdFilter }
  }

  const transports = await prisma.transport.findMany({
    where,
    include: { driver: true, contractor: true, seller: true },
    orderBy: { date: "desc" },
  })

  if (session.user.role === "DRIVER") {
    return NextResponse.json(
      transports.map((t) => ({ ...t, price: null }))
    )
  }

  return NextResponse.json(transports)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role === "ADMIN") {
    return NextResponse.json({ error: "Admins are read-only" }, { status: 403 })
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user)

  if (!isAdmin && !workspaceId) {
    return NextResponse.json({ error: "Workspace missing" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      date,
      orderNumber,
      fromPlace,
      toPlace,
      containerSize,
      isIMO,
      waitingFrom,
      waitingTo,
      price,
      driverId,
      contractorId,
      sellerId,
      notes,
    } = body

    if (!date || !fromPlace || !toPlace || !containerSize || !driverId) {
      return NextResponse.json(
        { error: "Required fields missing" },
        { status: 400 }
      )
    }

    if (session.user.role === "DRIVER" && driverId !== session.user.id) {
      return NextResponse.json(
        { error: "Drivers can only create transports for themselves" },
        { status: 403 }
      )
    }

    const transport = await prisma.transport.create({
      data: {
        workspaceId: workspaceId ?? null,
        date: new Date(date),
        orderNumber: orderNumber || null,
        fromPlace,
        toPlace,
        containerSize,
        isIMO: isIMO ?? false,
        waitingFrom: waitingFrom || null,
        waitingTo: waitingTo || null,
        freightLetterPath: null,
        price: session.user.role === "DRIVER" ? 0 : (price ?? 0),
        driverId,
        contractorId: contractorId || null,
        sellerId: sellerId || null,
        notes: notes || null,
      },
      include: { driver: true, contractor: true, seller: true },
    })

    if (workspaceId) {
      await storePlaceIfPossible(workspaceId, fromPlace)
      await storePlaceIfPossible(workspaceId, toPlace)
    }

    return NextResponse.json(transport, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
