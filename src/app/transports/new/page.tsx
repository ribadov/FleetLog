import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import NewTransportForm from "./NewTransportForm";

export default async function NewTransportPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <NewTransportForm
      users={users}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
