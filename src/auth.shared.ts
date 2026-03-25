import type { NextAuthConfig } from "next-auth"

export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim()

function resolveAuthSecret() {
  const env = process.env as Record<string, string | undefined>
  const configuredSecret =
    env.AUTH_SECRET ?? env.AUTHJS_SECRET ?? env.NEXTAUTH_SECRET ?? env.SECRET ?? ""

  const trimmedConfiguredSecret = configuredSecret.trim()
  if (trimmedConfiguredSecret) {
    return trimmedConfiguredSecret
  }

  const fallbackSeed =
    env.NEXTAUTH_URL ?? env.CF_PAGES_URL ?? env.VERCEL_URL ?? env.HOSTNAME ?? "fleetlog"

  console.error(
    "[Auth] Missing AUTH_SECRET/NEXTAUTH_SECRET. Using fallback secret. " +
      "Set AUTH_SECRET in production environment variables."
  )

  return `unsafe-fallback-secret:${fallbackSeed}`
}

const AUTH_SECRET = resolveAuthSecret()

function stripBasePath(pathname: string) {
  if (!BASE_PATH) return pathname
  if (!pathname.startsWith(BASE_PATH)) return pathname
  return pathname.slice(BASE_PATH.length) || "/"
}

const authSharedConfig: NextAuthConfig = {
  basePath: "/api/auth",
  trustHost: true,
  secret: AUTH_SECRET,
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const pathname = stripBasePath(nextUrl.pathname)
      const isAuthRoute = pathname === "/login" || pathname === "/register"
      const isProtectedRoute =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/transports") ||
        pathname.startsWith("/invoices") ||
        pathname.startsWith("/admin")

      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL(`${BASE_PATH || ""}/dashboard`, nextUrl))
        }
        return true
      }

      if (isProtectedRoute) {
        return isLoggedIn
      }

      return true
    },
  },
}

export default authSharedConfig