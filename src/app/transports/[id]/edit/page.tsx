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
    include: { driver: true, contractor: true, seller: true },
  });

  // Fetch legs separately to avoid depending on a generated Prisma client
  // that may not expose the relation under `legs` in all environments.
  const legs = await prisma.transportLeg.findMany({
    where: { transportId: id },
    orderBy: { sequence: "asc" },
  });

  if (!transport) notFound();

  if (transport.invoiceId) {
    redirect("/transports");
  }

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

  const assignedManagerIds = session.user.role === "CONTRACTOR"
    ? await listAssignedManagerIds(session.user.id)
    : []

  // For DRIVER: get manager's assigned contractor IDs
  let driverManagerContractorIds: string[] = [];
  if (session.user.role === "DRIVER") {
    const driverWorkspace = await prisma.workspace.findUnique({
      where: { id: transport.workspaceId ?? workspaceId ?? "" },
      select: { managerId: true },
    });

    if (driverWorkspace?.managerId) {
      driverManagerContractorIds = await listAssignedContractorIds(driverWorkspace.managerId);
    }
  }

  const assignedContractorIds = session.user.role === "MANAGER"
    ? await listAssignedContractorIds(session.user.id)
    : session.user.role === "DRIVER"
      ? driverManagerContractorIds
      : []

  const assignedContractors = assignedContractorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assignedContractorIds }, role: "CONTRACTOR" },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : []

  const usersCombined: typeof usersRaw = [
    ...usersRaw,
    ...assignedContractors.filter((candidate) => !usersRaw.some((existing) => existing.id === candidate.id)),
  ]

  const places = await listPlaceNames(transport.workspaceId ?? workspaceId ?? "");

  const serialized = {
    ...transport,
    date: transport.date.toISOString(),
    createdAt: transport.createdAt.toISOString(),
    updatedAt: transport.updatedAt.toISOString(),
    legs: legs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
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
