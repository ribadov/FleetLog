import type { NextAuthConfig } from "next-auth"

export const BASE_PATH = "/fleetlog"

const authSharedConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const pathname = nextUrl.pathname.startsWith(BASE_PATH)
        ? nextUrl.pathname.slice(BASE_PATH.length) || "/"
        : nextUrl.pathname
      const isAuthRoute = pathname === "/login" || pathname === "/register"
      const isProtectedRoute =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/transports") ||
        pathname.startsWith("/invoices") ||
        pathname.startsWith("/admin")

      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL(`${BASE_PATH}/dashboard`, nextUrl))
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