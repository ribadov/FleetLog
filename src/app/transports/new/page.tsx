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
  const needsWorkspaceCode = !isAdmin && session.user.role === "CONTRACTOR" && !workspaceId;

  if (!isAdmin && !workspaceId && session.user.role !== "CONTRACTOR") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: isAdmin
      ? {}
      : workspaceId
        ? { workspaceId }
        : { role: { in: ["DRIVER", "MANAGER", "CONTRACTOR"] }, workspaceId: { not: null } },
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
    ...users,
    ...assignedContractors.filter((candidate) => !users.some((existing) => existing.id === candidate.id)),
  ]

  const assignedManagerIds = session.user.role === "CONTRACTOR"
    ? await listAssignedManagerIds(session.user.id)
    : []

  const places = workspaceId ? await listPlaceNames(workspaceId) : [];

  return (
    <NewTransportForm
      users={usersCombined}
      places={places}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
      needsWorkspaceCode={needsWorkspaceCode}
      allowedManagerIds={assignedManagerIds}
    />
  );
}
