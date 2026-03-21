import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storePlaceIfPossible } from "@/lib/places"
import { getTenantContext } from "@/lib/tenant"
import { calculateImoSurcharge, calculateLegTotal } from "@/lib/pricing"
import { isManagerAssignedToContractor } from "@/lib/contractor-partners"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const driverIdFilter = searchParams.get("driverId")
  const { isAdmin, workspaceId } = getTenantContext(session.user)

  if (!isAdmin && session.user.role !== "CONTRACTOR" && !workspaceId) {
    return NextResponse.json({ error: "Workspace missing" }, { status: 403 })
  }

  let where: Record<string, unknown> = {}
  if (!isAdmin && session.user.role !== "CONTRACTOR") {
    where = { ...where, workspaceId }
  }

  if (session.user.role === "CONTRACTOR") {
    where = { ...where, contractorId: session.user.id }
  }

  if (session.user.role === "DRIVER") {
    where = { ...where, driverId: session.user.id }
  } else if (driverIdFilter && session.user.role === "MANAGER") {
    where = { ...where, driverId: driverIdFilter }
  }

  const transports = await prisma.transport.findMany({
    where,
    include: { driver: true, contractor: true, seller: true, legs: { orderBy: { sequence: "asc" } } },
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

  if (!isAdmin && session.user.role !== "CONTRACTOR" && !workspaceId) {
    return NextResponse.json({ error: "Workspace missing" }, { status: 403 })
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
      workspaceCode,
      legs,
    } = body

    const normalizedContainerNumber = typeof containerNumber === "string"
      ? containerNumber.trim()
      : typeof orderNumber === "string"
        ? orderNumber.trim()
        : ""
    if (!normalizedContainerNumber) {
      return NextResponse.json(
        { error: "Container number is required" },
        { status: 400 }
      )
    }

    const normalizedJobNumber = typeof jobNumber === "string" ? jobNumber.trim() : ""

    if (!date || !containerSize || !driverId) {
      return NextResponse.json(
        { error: "Required fields missing" },
        { status: 400 }
      )
    }

    let targetWorkspaceId = workspaceId ?? null

    if (session.user.role === "CONTRACTOR" && !targetWorkspaceId) {
      const normalizedWorkspaceCode = typeof workspaceCode === "string" ? workspaceCode.trim().toUpperCase() : ""
      if (!normalizedWorkspaceCode) {
        return NextResponse.json(
          { error: "Workspace code is required for this order" },
          { status: 400 }
        )
      }

      const workspace = await prisma.workspace.findUnique({ where: { code: normalizedWorkspaceCode }, select: { id: true, managerId: true } })
      if (!workspace) {
        return NextResponse.json(
          { error: "Invalid workspace code" },
          { status: 400 }
        )
      }

      targetWorkspaceId = workspace.id
    }

    if (!targetWorkspaceId) {
      return NextResponse.json({ error: "Workspace missing" }, { status: 403 })
    }

    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, role: true, workspaceId: true },
    })

    if (!driver || driver.role !== "DRIVER" || driver.workspaceId !== targetWorkspaceId) {
      return NextResponse.json(
        { error: "Invalid driver for selected workspace" },
        { status: 400 }
      )
    }

    if (session.user.role === "DRIVER" && driverId !== session.user.id) {
      return NextResponse.json(
        { error: "Drivers can only create transports for themselves" },
        { status: 403 }
      )
    }

    if (session.user.role === "CONTRACTOR" && !sellerId) {
      return NextResponse.json(
        { error: "Subcontractor is required" },
        { status: 400 }
      )
    }

    if (sellerId) {
      const seller = await prisma.user.findUnique({
        where: { id: sellerId },
        select: { id: true, role: true, workspaceId: true },
      })

      if (!seller || seller.role !== "MANAGER" || seller.workspaceId !== targetWorkspaceId) {
        return NextResponse.json(
          { error: "Invalid seller for selected workspace" },
          { status: 400 }
        )
      }

      if (session.user.role === "CONTRACTOR") {
        const assigned = await isManagerAssignedToContractor(session.user.id, sellerId)
        if (!assigned) {
          return NextResponse.json(
            { error: "Selected subcontractor is not assigned to this client" },
            { status: 400 }
          )
        }
      }
    }

    let resolvedContractorId: string | null = contractorId || null
    if (session.user.role === "CONTRACTOR") {
      resolvedContractorId = session.user.id
    } else if (resolvedContractorId) {
      const contractor = await prisma.user.findUnique({
        where: { id: resolvedContractorId },
        select: { id: true, role: true, workspaceId: true },
      })

      if (!contractor || contractor.role !== "CONTRACTOR") {
        return NextResponse.json(
          { error: "Invalid contractor" },
          { status: 400 }
        )
      }

      if (session.user.role === "MANAGER") {
        const assigned = await isManagerAssignedToContractor(resolvedContractorId, session.user.id)
        if (!assigned) {
          return NextResponse.json(
            { error: "Client is not assigned to this subcontractor" },
            { status: 400 }
          )
        }
      }
    }

    if (session.user.role === "MANAGER" && !resolvedContractorId) {
      return NextResponse.json(
        { error: "Client is required" },
        { status: 400 }
      )
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

    const preparedLegs: LegPayload[] = []
    const canSetPrices = session.user.role === "CONTRACTOR" || session.user.role === "MANAGER"

    if (Array.isArray(legs) && legs.length > 0) {
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
        const basePrice = canSetPrices && Number.isFinite(parsedBasePrice) && parsedBasePrice > 0 ? parsedBasePrice : 0
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
    } else {
      const singleFrom = typeof fromPlace === "string" ? fromPlace.trim() : ""
      const singleTo = typeof toPlace === "string" ? toPlace.trim() : ""
      if (!singleFrom || !singleTo) {
        return NextResponse.json(
          { error: "Required fields missing" },
          { status: 400 }
        )
      }

      const parsedBasePrice = Number(price ?? 0)
      const basePrice = canSetPrices && Number.isFinite(parsedBasePrice) && parsedBasePrice > 0 ? parsedBasePrice : 0
      const waitingFromValue = typeof waitingFrom === "string" && waitingFrom.trim() ? waitingFrom.trim() : null
      const waitingToValue = typeof waitingTo === "string" && waitingTo.trim() ? waitingTo.trim() : null
      const totals = calculateLegTotal(basePrice, waitingFromValue, waitingToValue)

      preparedLegs.push({
        sequence: 1,
        fromPlace: singleFrom,
        toPlace: singleTo,
        waitingFrom: waitingFromValue,
        waitingTo: waitingToValue,
        basePrice,
        waitingMinutes: totals.waitingMinutes,
        waitingSurcharge: totals.waitingSurcharge,
        totalPrice: totals.totalPrice,
      })
    }

    const firstLeg = preparedLegs[0]
    const lastLeg = preparedLegs[preparedLegs.length - 1]
    const transportBasePrice = preparedLegs.reduce((sum, leg) => sum + leg.basePrice, 0)
    const transportWaitingMinutes = preparedLegs.reduce((sum, leg) => sum + leg.waitingMinutes, 0)
    const transportWaitingSurcharge = preparedLegs.reduce((sum, leg) => sum + leg.waitingSurcharge, 0)
    const transportLegsTotalPrice = preparedLegs.reduce((sum, leg) => sum + leg.totalPrice, 0)
    const transportImoSurcharge = calculateImoSurcharge(Boolean(isIMO))
    const transportTotalPrice = transportLegsTotalPrice + transportImoSurcharge

    const transport = await prisma.transport.create({
      data: {
        workspaceId: targetWorkspaceId,
        date: new Date(date),
        orderNumber: normalizedContainerNumber,
        jobNumber: normalizedJobNumber || null,
        fromPlace: firstLeg.fromPlace,
        toPlace: lastLeg.toPlace,
        containerSize,
        isIMO: isIMO ?? false,
        waitingFrom: firstLeg.waitingFrom,
        waitingTo: lastLeg.waitingTo,
        freightLetterPath: null,
        basePrice: transportBasePrice,
        waitingMinutes: transportWaitingMinutes,
        waitingSurcharge: transportWaitingSurcharge,
        imoSurcharge: transportImoSurcharge,
        price: transportTotalPrice,
        driverId,
        contractorId: resolvedContractorId,
        sellerId: sellerId || null,
        notes: notes || null,
        legs: {
          create: preparedLegs.map((leg) => ({
            sequence: leg.sequence,
            fromPlace: leg.fromPlace,
            toPlace: leg.toPlace,
            waitingFrom: leg.waitingFrom,
            waitingTo: leg.waitingTo,
            basePrice: leg.basePrice,
            waitingMinutes: leg.waitingMinutes,
            waitingSurcharge: leg.waitingSurcharge,
            totalPrice: leg.totalPrice,
          })),
        },
      },
      include: { driver: true, contractor: true, seller: true, legs: { orderBy: { sequence: "asc" } } },
    })

    await Promise.all(
      preparedLegs.flatMap((leg) => [
        storePlaceIfPossible(targetWorkspaceId, leg.fromPlace),
        storePlaceIfPossible(targetWorkspaceId, leg.toPlace),
      ])
    )

    return NextResponse.json(transport, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
