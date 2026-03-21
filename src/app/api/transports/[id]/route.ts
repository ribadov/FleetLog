import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storePlaceIfPossible } from "@/lib/places"
import { getTenantContext } from "@/lib/tenant"
import { calculateImoSurcharge, calculateLegTotal } from "@/lib/pricing"
import { isManagerAssignedToContractor } from "@/lib/contractor-partners"
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
    include: { driver: true, contractor: true, seller: true, legs: { orderBy: { sequence: "asc" } } },
  })
  if (!transport) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!isAdmin) {
    if (session.user.role === "CONTRACTOR") {
      if (transport.contractorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (transport.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
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

  if (!isAdmin) {
    if (session.user.role === "CONTRACTOR") {
      if (transport.contractorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (transport.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
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
      containerNumber,
      orderNumber,
      jobNumber,
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
      legs,
    } = body

    const canEditPrice = session.user.role === "MANAGER" || session.user.role === "CONTRACTOR"

    if (containerNumber === undefined && orderNumber === undefined && !transport.orderNumber) {
      return NextResponse.json({ error: "Container number is required" }, { status: 400 })
    }

    let nextContractorId = contractorId !== undefined ? contractorId || null : transport.contractorId
    if (session.user.role === "CONTRACTOR") {
      nextContractorId = session.user.id
    }

    if (nextContractorId) {
      const contractor = await prisma.user.findUnique({
        where: { id: nextContractorId },
        select: { id: true, role: true, workspaceId: true },
      })

      if (!contractor || contractor.role !== "CONTRACTOR") {
        return NextResponse.json({ error: "Invalid contractor" }, { status: 400 })
      }

      if (session.user.role === "MANAGER") {
        const assigned = await isManagerAssignedToContractor(nextContractorId, session.user.id)
        if (!assigned) {
          return NextResponse.json(
            { error: "Client is not assigned to this subcontractor" },
            { status: 400 }
          )
        }
      }
    }

    if (session.user.role === "MANAGER" && !nextContractorId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 })
    }

    let nextSellerId = sellerId !== undefined ? sellerId || null : transport.sellerId
    if (nextSellerId) {
      const seller = await prisma.user.findUnique({
        where: { id: nextSellerId },
        select: { id: true, role: true, workspaceId: true },
      })

      if (!seller || seller.role !== "MANAGER" || seller.workspaceId !== transport.workspaceId) {
        return NextResponse.json(
          { error: "Invalid seller for selected workspace" },
          { status: 400 }
        )
      }

      if (session.user.role === "CONTRACTOR") {
        const assigned = await isManagerAssignedToContractor(session.user.id, nextSellerId)
        if (!assigned) {
          return NextResponse.json(
            { error: "Selected subcontractor is not assigned to this client" },
            { status: 400 }
          )
        }
      }
    }

    if (session.user.role === "MANAGER" && nextSellerId === session.user.id) {
      nextSellerId = session.user.id
    }

    if (session.user.role === "CONTRACTOR" && !nextSellerId) {
      return NextResponse.json(
        { error: "Subcontractor is required" },
        { status: 400 }
      )
    }

    let nextDriverId = driverId || transport.driverId
    if (session.user.role === "DRIVER") {
      nextDriverId = session.user.id
    }

    if (nextDriverId !== transport.driverId || driverId) {
      const nextDriver = await prisma.user.findUnique({
        where: { id: nextDriverId },
        select: { id: true, role: true, workspaceId: true },
      })

      if (!nextDriver || nextDriver.role !== "DRIVER" || nextDriver.workspaceId !== transport.workspaceId) {
        return NextResponse.json(
          { error: "Invalid driver for selected workspace" },
          { status: 400 }
        )
      }
    }

    type LegPayload = {
      sequence: number
      fromPlace: string
      toPlace: string
      waitingFrom: string | null
      waitingTo: string | null
      basePrice: number
      waitingMinutes: number
      waitingSurcharge: number
      totalPrice: number
    }

    let preparedLegs: LegPayload[] | null = null

    if (Array.isArray(legs) && legs.length > 0) {
      preparedLegs = []
      for (let index = 0; index < legs.length; index += 1) {
        const leg = legs[index]
        const legFrom = typeof leg?.fromPlace === "string" ? leg.fromPlace.trim() : ""
        const legTo = typeof leg?.toPlace === "string" ? leg.toPlace.trim() : ""
        if (!legFrom || !legTo) {
          return NextResponse.json(
            { error: "Every stop needs origin and destination" },
            { status: 400 }
          )
        }

        const parsedBasePrice = Number(leg?.price ?? 0)
        const basePrice = canEditPrice && Number.isFinite(parsedBasePrice) && parsedBasePrice > 0 ? parsedBasePrice : 0
        const waitingFromValue = typeof leg?.waitingFrom === "string" && leg.waitingFrom.trim() ? leg.waitingFrom.trim() : null
        const waitingToValue = typeof leg?.waitingTo === "string" && leg.waitingTo.trim() ? leg.waitingTo.trim() : null
        const totals = calculateLegTotal(basePrice, waitingFromValue, waitingToValue)

        preparedLegs.push({
          sequence: index + 1,
          fromPlace: legFrom,
          toPlace: legTo,
          waitingFrom: waitingFromValue,
          waitingTo: waitingToValue,
          basePrice,
          waitingMinutes: totals.waitingMinutes,
          waitingSurcharge: totals.waitingSurcharge,
          totalPrice: totals.totalPrice,
        })
      }
    }

    const hasSingleRouteUpdate =
      fromPlace !== undefined ||
      toPlace !== undefined ||
      waitingFrom !== undefined ||
      waitingTo !== undefined ||
      price !== undefined

    if (!preparedLegs && hasSingleRouteUpdate) {
      const singleFrom = typeof fromPlace === "string" && fromPlace.trim() ? fromPlace.trim() : transport.fromPlace
      const singleTo = typeof toPlace === "string" && toPlace.trim() ? toPlace.trim() : transport.toPlace
      const waitingFromValue = waitingFrom !== undefined ? (typeof waitingFrom === "string" && waitingFrom.trim() ? waitingFrom.trim() : null) : transport.waitingFrom
      const waitingToValue = waitingTo !== undefined ? (typeof waitingTo === "string" && waitingTo.trim() ? waitingTo.trim() : null) : transport.waitingTo
      const parsedBasePrice = Number(price ?? transport.basePrice)
      const basePrice = canEditPrice && Number.isFinite(parsedBasePrice) && parsedBasePrice > 0 ? parsedBasePrice : 0
      const totals = calculateLegTotal(basePrice, waitingFromValue, waitingToValue)

      preparedLegs = [
        {
          sequence: 1,
          fromPlace: singleFrom,
          toPlace: singleTo,
          waitingFrom: waitingFromValue,
          waitingTo: waitingToValue,
          basePrice,
          waitingMinutes: totals.waitingMinutes,
          waitingSurcharge: totals.waitingSurcharge,
          totalPrice: totals.totalPrice,
        },
      ]
    }

    const updateData: Record<string, unknown> = {
      ...(date && { date: new Date(date) }),
      notes: notes !== undefined ? notes || null : transport.notes,
      contractorId: nextContractorId,
      sellerId: nextSellerId,
      ...(session.user.role !== "DRIVER" && driverId && { driverId: nextDriverId }),
    }

    if (orderNumber !== undefined) {
      const normalizedContainerNumber = typeof orderNumber === "string" ? orderNumber.trim() : ""
      if (!normalizedContainerNumber) {
        return NextResponse.json({ error: "Container number is required" }, { status: 400 })
      }
      updateData.orderNumber = normalizedContainerNumber
    }

    if (containerNumber !== undefined) {
      const normalizedContainerNumber = typeof containerNumber === "string" ? containerNumber.trim() : ""
      if (!normalizedContainerNumber) {
        return NextResponse.json({ error: "Container number is required" }, { status: 400 })
      }
      updateData.orderNumber = normalizedContainerNumber
    }

    if (jobNumber !== undefined) {
      const normalizedJobNumber = typeof jobNumber === "string" ? jobNumber.trim() : ""
      updateData.jobNumber = normalizedJobNumber || null
    }

    const nextIsIMO = isIMO !== undefined ? Boolean(isIMO) : transport.isIMO

    if (preparedLegs) {
      const firstLeg = preparedLegs[0]
      const lastLeg = preparedLegs[preparedLegs.length - 1]

      updateData.fromPlace = firstLeg.fromPlace
      updateData.toPlace = lastLeg.toPlace
      updateData.waitingFrom = firstLeg.waitingFrom
      updateData.waitingTo = lastLeg.waitingTo
      updateData.basePrice = preparedLegs.reduce((sum, leg) => sum + leg.basePrice, 0)
      updateData.waitingMinutes = preparedLegs.reduce((sum, leg) => sum + leg.waitingMinutes, 0)
      updateData.waitingSurcharge = preparedLegs.reduce((sum, leg) => sum + leg.waitingSurcharge, 0)
      const legsTotal = preparedLegs.reduce((sum, leg) => sum + leg.totalPrice, 0)
      const imoSurcharge = calculateImoSurcharge(nextIsIMO)
      updateData.imoSurcharge = imoSurcharge
      updateData.price = legsTotal + imoSurcharge
    } else if (isIMO !== undefined) {
      const imoSurcharge = calculateImoSurcharge(nextIsIMO)
      updateData.imoSurcharge = imoSurcharge
      updateData.price = transport.basePrice + transport.waitingSurcharge + imoSurcharge
    }

    if (containerSize) {
      updateData.containerSize = containerSize
    }

    if (isIMO !== undefined) {
      updateData.isIMO = isIMO
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (preparedLegs) {
        await tx.transportLeg.deleteMany({ where: { transportId: id } })
      }

      const updatedTransport = await tx.transport.update({
        where: { id },
        data: updateData,
        include: { driver: true, contractor: true, seller: true, legs: { orderBy: { sequence: "asc" } } },
      })

      if (preparedLegs) {
        for (const leg of preparedLegs) {
          await tx.transportLeg.create({
            data: {
              transportId: id,
              sequence: leg.sequence,
              fromPlace: leg.fromPlace,
              toPlace: leg.toPlace,
              waitingFrom: leg.waitingFrom,
              waitingTo: leg.waitingTo,
              basePrice: leg.basePrice,
              waitingMinutes: leg.waitingMinutes,
              waitingSurcharge: leg.waitingSurcharge,
              totalPrice: leg.totalPrice,
            },
          })
        }

        return tx.transport.findUniqueOrThrow({
          where: { id },
          include: { driver: true, contractor: true, seller: true, legs: { orderBy: { sequence: "asc" } } },
        })
      }

      return updatedTransport
    })

    if (preparedLegs && transport.workspaceId) {
      await Promise.all(
        preparedLegs.flatMap((leg) => [
          storePlaceIfPossible(transport.workspaceId as string, leg.fromPlace),
          storePlaceIfPossible(transport.workspaceId as string, leg.toPlace),
        ])
      )
    } else {
      if (fromPlace && transport.workspaceId) {
        await storePlaceIfPossible(transport.workspaceId, fromPlace)
      }

      if (toPlace && transport.workspaceId) {
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
