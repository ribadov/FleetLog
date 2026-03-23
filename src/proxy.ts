import { NextRequest, NextResponse } from "next/server"

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim()

function stripBasePath(pathname: string) {
  if (!BASE_PATH) return pathname
  if (!pathname.startsWith(BASE_PATH)) return pathname
  return pathname.slice(BASE_PATH.length) || "/"
}

function hasSessionCookie(request: NextRequest) {
  const possibleSessionCookies = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "__Host-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "__Host-next-auth.session-token",
  ]

  return possibleSessionCookies.some((cookieName) => request.cookies.has(cookieName))
}

export default function proxy(request: NextRequest) {
  const pathname = stripBasePath(request.nextUrl.pathname)
  const isLoggedIn = hasSessionCookie(request)
  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/transports") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/admin")

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(`${BASE_PATH || ""}/dashboard`, request.url))
  }

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL(`${BASE_PATH || ""}/login`, request.url)
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("callbackUrl", callbackUrl)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
