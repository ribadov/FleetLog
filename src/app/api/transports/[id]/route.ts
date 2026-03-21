import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storePlaceIfPossible } from "@/lib/places"
import { getTenantContext } from "@/lib/tenant"
import { auth } from "@/auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { isAdmin, workspaceId } = getTenantContext(session.user)
  const transport = await prisma.transport.findUnique({
    where: { id },
    include: { driver: true, contractor: true, seller: true },
  })
  if (!transport) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!isAdmin && transport.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (
    session.user.role === "DRIVER" &&
    transport.driverId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (session.user.role === "DRIVER") {
    return NextResponse.json({ ...transport, price: null })
  }

  return NextResponse.json(transport)
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role === "ADMIN") {
    return NextResponse.json({ error: "Admins are read-only" }, { status: 403 })
  }

  const { id } = await params
  const { isAdmin, workspaceId } = getTenantContext(session.user)

  const transport = await prisma.transport.findUnique({ where: { id } })
  if (!transport) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!isAdmin && transport.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (
    session.user.role === "DRIVER" &&
    transport.driverId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

    const updated = await prisma.transport.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        orderNumber: orderNumber !== undefined ? orderNumber || null : transport.orderNumber,
        ...(fromPlace && { fromPlace }),
        ...(toPlace && { toPlace }),
        ...(containerSize && { containerSize }),
        ...(isIMO !== undefined && { isIMO }),
        waitingFrom: waitingFrom !== undefined ? (waitingFrom || null) : transport.waitingFrom,
        waitingTo: waitingTo !== undefined ? (waitingTo || null) : transport.waitingTo,
        ...(session.user.role !== "DRIVER" && price !== undefined && { price }),
        ...(session.user.role !== "DRIVER" && driverId && { driverId }),
        contractorId: contractorId !== undefined ? contractorId || null : transport.contractorId,
        sellerId: sellerId !== undefined ? sellerId || null : transport.sellerId,
        notes: notes !== undefined ? notes || null : transport.notes,
      },
      include: { driver: true, contractor: true, seller: true },
    })

    if (fromPlace) {
      if (transport.workspaceId) {
        await storePlaceIfPossible(transport.workspaceId, fromPlace)
      }
    }

    if (toPlace) {
      if (transport.workspaceId) {
        await storePlaceIfPossible(transport.workspaceId, toPlace)
      }
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role === "ADMIN") {
    return NextResponse.json({ error: "Admins are read-only" }, { status: 403 })
  }

  if (session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { isAdmin, workspaceId } = getTenantContext(session.user)

  const transport = await prisma.transport.findUnique({ where: { id } })
  if (!transport) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!isAdmin && transport.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.transport.delete({ where: { id } })
  return NextResponse.json({ message: "Transport deleted" })
}
