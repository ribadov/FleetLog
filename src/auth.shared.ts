import type { NextAuthConfig } from "next-auth"

export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim()

function stripBasePath(pathname: string) {
  if (!BASE_PATH) return pathname
  if (!pathname.startsWith(BASE_PATH)) return pathname
  return pathname.slice(BASE_PATH.length) || "/"
}

const authSharedConfig: NextAuthConfig = {
  trustHost: true,
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