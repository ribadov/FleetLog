import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listPlaceNames } from "@/lib/places";
import { getTenantContext } from "@/lib/tenant";
import { listAssignedContractorIds, listAssignedManagerIds } from "@/lib/contractor-partners";
import { redirect, notFound } from "next/navigation";
import EditTransportForm from "./EditTransportForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditTransportPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  const { id } = await params;

  const transport = await prisma.transport.findUnique({
    where: { id },
    include: { driver: true, contractor: true, seller: true, legs: { orderBy: { sequence: "asc" } } },
  });

  if (!transport) notFound();

  if (!isAdmin) {
    if (session.user.role === "CONTRACTOR") {
      if (transport.contractorId !== session.user.id) {
        redirect("/transports");
      }
    } else if (transport.workspaceId !== workspaceId) {
      redirect("/transports");
    }
  }

  if (
    session.user.role === "DRIVER" &&
    transport.driverId !== session.user.id
  ) {
    redirect("/transports");
  }

  const usersRaw = await prisma.user.findMany({
    where: isAdmin ? {} : { workspaceId: transport.workspaceId ?? workspaceId ?? undefined },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const assignedContractorIds = session.user.role === "MANAGER"
    ? await listAssignedContractorIds(session.user.id)
    : []

  const assignedContractors = assignedContractorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assignedContractorIds }, role: "CONTRACTOR" },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : []

  const usersCombined = [
    ...usersRaw,
    ...assignedContractors.filter((candidate) => !usersRaw.some((existing) => existing.id === candidate.id)),
  ]

  const assignedManagerIds = session.user.role === "CONTRACTOR"
    ? await listAssignedManagerIds(session.user.id)
    : []

  const places = await listPlaceNames(transport.workspaceId ?? workspaceId ?? "");

  const serialized = {
    ...transport,
    date: transport.date.toISOString(),
    createdAt: transport.createdAt.toISOString(),
    updatedAt: transport.updatedAt.toISOString(),
  };

  return (
    <EditTransportForm
      transport={serialized}
      users={usersCombined}
      places={places}
      role={session.user.role}
      allowedManagerIds={assignedManagerIds}
    />
  );
}
