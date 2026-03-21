import type { Session } from "next-auth";

export type TenantContext = {
  isAdmin: boolean;
  workspaceId: string | null;
};

export function getTenantContext(user: Session["user"]): TenantContext {
  const isAdmin = user.role === "ADMIN";
  return {
    isAdmin,
    workspaceId: isAdmin ? null : (user.workspaceId ?? null),
  };
}

export function requireWorkspaceId(user: Session["user"]): string {
  if (user.role === "ADMIN") {
    throw new Error("ADMIN does not have a single workspace scope");
  }

  if (!user.workspaceId) {
    throw new Error("User has no workspace assigned");
  }

  return user.workspaceId;
}
