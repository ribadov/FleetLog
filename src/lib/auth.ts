import type { DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession["user"] & {
  id: string
  role: "DRIVER" | "CONTRACTOR" | "MANAGER"
}
