import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EditTransportForm from "./EditTransportForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditTransportPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const transport = await prisma.transport.findUnique({
    where: { id },
    include: { driver: true, contractor: true, seller: true },
  });

  if (!transport) notFound();

  if (
    session.user.role === "DRIVER" &&
    transport.driverId !== session.user.id
  ) {
    redirect("/transports");
  }

  const usersRaw = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const serialized = {
    ...transport,
    date: transport.date.toISOString(),
    createdAt: transport.createdAt.toISOString(),
    updatedAt: transport.updatedAt.toISOString(),
  };

  return (
    <EditTransportForm
      transport={serialized}
      users={usersRaw}
      role={session.user.role}
    />
  );
}
