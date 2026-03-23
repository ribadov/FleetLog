import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

function buildInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const randomPart = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}-${randomPart}`;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAdmin && !workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where =
    isAdmin
        ? {}
        : { workspaceId };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { contractor: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only managers can create invoices" },
      { status: 403 }
    );
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  if (!isAdmin && !workspaceId) {
    return NextResponse.json({ error: "Workspace missing" }, { status: 403 });
  }

  const { contractorId } = await req.json();
  if (!contractorId) {
    return NextResponse.json(
      { error: "contractorId is required" },
      { status: 400 }
    );
  }

  const contractor = await prisma.user.findUnique({
    where: { id: contractorId },
    select: { id: true, email: true, billingEmail: true, role: true, workspaceId: true },
  });

  if (
    !contractor ||
    contractor.role !== "CONTRACTOR"
  ) {
    return NextResponse.json(
      { error: "Contractor not found" },
      { status: 404 }
    );
  }

  const openTransports = await prisma.transport.findMany({
    where: {
      contractorId,
      invoiceId: null,
      ...(isAdmin ? {} : { workspaceId }),
    },
    select: {
      id: true,
      price: true,
      workspaceId: true,
    },
  });

  if (openTransports.length === 0) {
    return NextResponse.json(
      { error: "No uninvoiced containers found" },
      { status: 400 }
    );
  }

  const totalAmount = openTransports.reduce((sum, transport) => sum + transport.price, 0);
  const itemsCount = openTransports.length;
  const invoiceNumber = buildInvoiceNumber();
  const uniqueWorkspaceIds = Array.from(new Set(openTransports.map((transport) => transport.workspaceId).filter(Boolean)));
  const invoiceWorkspaceId = isAdmin
    ? uniqueWorkspaceIds.length === 1
      ? uniqueWorkspaceIds[0]!
      : null
    : workspaceId;

  if (!invoiceWorkspaceId) {
    return NextResponse.json(
      { error: "Open transports must belong to one workspace" },
      { status: 400 }
    );
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        contractorId,
        workspaceId: invoiceWorkspaceId,
        recipientEmail: contractor.billingEmail ?? contractor.email,
        totalAmount,
        itemsCount,
      },
    });

    await tx.transport.updateMany({
      where: {
        id: {
          in: openTransports.map((transport) => transport.id),
        },
      },
      data: {
        invoiceId: createdInvoice.id,
      },
    });

    return createdInvoice;
  });

  return NextResponse.json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }, { status: 201 });
}
