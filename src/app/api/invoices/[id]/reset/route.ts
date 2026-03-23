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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user);
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, sentAt: true, workspaceId: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!isAdmin && invoice.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.sentAt) {
    return NextResponse.json(
      { error: "Sent invoices cannot be reset" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.transport.updateMany({
      where: { invoiceId: id },
      data: { invoiceId: null },
    });

    await tx.invoice.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
