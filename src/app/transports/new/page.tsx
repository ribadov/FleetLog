import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listPlaceNames } from "@/lib/places";
import { getTenantContext } from "@/lib/tenant";
import { listAssignedContractorIds, listAssignedManagerIds } from "@/lib/contractor-partners";
import NewTransportForm from "./NewTransportForm";

export default async function NewTransportPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  if (!isAdmin && !workspaceId && session.user.role !== "CONTRACTOR") {
    redirect("/dashboard");
  }

  const assignedManagerIds = session.user.role === "CONTRACTOR"
    ? await listAssignedManagerIds(session.user.id)
    : []

  const assignedManagers = assignedManagerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assignedManagerIds }, role: "MANAGER" },
        select: { id: true, name: true, role: true, workspaceId: true },
        orderBy: { name: "asc" },
      })
    : []

  const assignedManagerWorkspaceIds = assignedManagers
    .map((manager) => manager.workspaceId)
    .filter((value): value is string => Boolean(value))

  const users = await prisma.user.findMany({
    where: isAdmin
      ? {}
      : workspaceId
        ? session.user.role === "MANAGER"
          ? { workspaceId, role: { in: ["DRIVER", "MANAGER"] } }
          : { workspaceId }
        : { role: { in: ["DRIVER", "MANAGER", "CONTRACTOR"] }, workspaceId: { not: null } },
    select: { id: true, name: true, role: true, workspaceId: true },
    orderBy: { name: "asc" },
  });

  const assignedContractorIds = session.user.role === "MANAGER"
    ? await listAssignedContractorIds(session.user.id)
    : []

  const assignedContractors = assignedContractorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assignedContractorIds }, role: "CONTRACTOR" },
        select: { id: true, name: true, role: true, workspaceId: true },
        orderBy: { name: "asc" },
      })
    : []

  const assignedContractorWorkspaceIds = assignedContractors
    .map((contractor) => contractor.workspaceId)
    .filter((value): value is string => Boolean(value))

  const assignedContractorDrivers = session.user.role === "MANAGER" && assignedContractorWorkspaceIds.length
    ? await prisma.user.findMany({
        where: {
          role: "DRIVER",
          workspaceId: { in: assignedContractorWorkspaceIds },
        },
        select: { id: true, name: true, role: true, workspaceId: true },
        orderBy: { name: "asc" },
      })
    : []

  const assignedManagerDrivers = session.user.role === "CONTRACTOR" && assignedManagerWorkspaceIds.length
    ? await prisma.user.findMany({
        where: {
          role: "DRIVER",
          workspaceId: { in: assignedManagerWorkspaceIds },
        },
        select: { id: true, name: true, role: true, workspaceId: true },
        orderBy: { name: "asc" },
      })
    : []

  const usersCombined = [
    ...users,
    ...assignedManagers.filter((candidate) => !users.some((existing) => existing.id === candidate.id)),
    ...assignedManagerDrivers.filter((candidate) => !users.some((existing) => existing.id === candidate.id)),
    ...assignedContractorDrivers.filter((candidate) => !users.some((existing) => existing.id === candidate.id)),
    ...assignedContractors.filter((candidate) => !users.some((existing) => existing.id === candidate.id)),
  ]

  const places = workspaceId ? await listPlaceNames(workspaceId) : [];

  return (
    <NewTransportForm
      users={usersCombined}
      places={places}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
      allowedManagerIds={assignedManagerIds}
    />
  );
}
