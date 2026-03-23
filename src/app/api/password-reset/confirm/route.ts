import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json() as { 
      token: string | undefined
      newPassword: string | undefined
    }

    if (!token || String(token).trim() === "") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!newPassword || String(newPassword).trim() === "") {
      return NextResponse.json({ error: "New password is required" }, { status: 400 })
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // Find and validate token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: String(token).trim() },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return NextResponse.json(
        { error: "Reset link has expired" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(String(newPassword), 10)

    // Update user password and invalidate all tokens for that email
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email: resetToken.email },
        data: { password: hashedPassword },
      })

      await tx.passwordResetToken.deleteMany({
        where: { email: resetToken.email },
      })
    })

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Password Reset Confirm API Error]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
