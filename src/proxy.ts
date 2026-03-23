import NextAuth from "next-auth"
import authSharedConfig from "@/auth.shared"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authSharedConfig)

const middleware = auth(() => NextResponse.next())

export default middleware

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
