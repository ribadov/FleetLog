import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listPlaceNames } from "@/lib/places";
import { getTenantContext } from "@/lib/tenant";
import NewTransportForm from "./NewTransportForm";

export default async function NewTransportPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  if (!isAdmin && !workspaceId) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: isAdmin ? {} : { workspaceId: workspaceId ?? undefined },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const places = await listPlaceNames(workspaceId ?? "");

  return (
    <NewTransportForm
      users={users}
      places={places}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
