import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only managers can send invoices" },
      { status: 403 }
    );
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contractor: {
        select: { email: true, billingEmail: true },
      },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!isAdmin && invoice.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.sentAt) {
    return NextResponse.json(
      { error: "Invoice is already sent" },
      { status: 400 }
    );
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      sentAt: new Date(),
      sentById: session.user.id,
      recipientEmail: invoice.contractor.billingEmail ?? invoice.contractor.email,
    },
  });

  return NextResponse.json({
    id: updated.id,
    sentAt: updated.sentAt,
    recipientEmail: updated.recipientEmail,
  });
}
