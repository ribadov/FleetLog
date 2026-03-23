import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { NextAuthConfig } from "next-auth"
import type { JWT } from "@auth/core/jwt"
import authSharedConfig from "@/auth.shared"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: "ADMIN" | "DRIVER" | "CONTRACTOR" | "MANAGER"
      workspaceId?: string | null
    }
  }
  interface User {
    role: "ADMIN" | "DRIVER" | "CONTRACTOR" | "MANAGER"
    workspaceId?: string | null
  }
}

type ExtendedJWT = JWT & {
  id: string
  role: "ADMIN" | "DRIVER" | "CONTRACTOR" | "MANAGER"
  workspaceId?: string | null
}

const config: NextAuthConfig = {
  ...authSharedConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    ...authSharedConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.name = user.name
        ;(token as ExtendedJWT).role = user.role
        ;(token as ExtendedJWT).workspaceId = user.workspaceId
      }

      if (trigger === "update" && session) {
        const updatePayload = session as { name?: unknown; user?: { name?: unknown } }
        if (typeof updatePayload.name === "string") {
          token.name = updatePayload.name
        } else if (typeof updatePayload.user?.name === "string") {
          token.name = updatePayload.user.name
        }
      }

      return token
    },
    async session({ session, token }) {
      const t = token as ExtendedJWT
      if (t) {
        session.user.id = t.id
        session.user.name = token.name
        session.user.role = t.role
        session.user.workspaceId = t.workspaceId ?? null
      }
      return session
    },
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(config)
