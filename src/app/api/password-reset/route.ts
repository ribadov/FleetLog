import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/mailer"

const RESET_TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json() as { email: string | undefined }

    if (!email || String(email).trim() === "") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      // Return success anyway for security (don't reveal if email exists)
      return NextResponse.json(
        { message: "If email exists, reset link will be sent" },
        { status: 200 }
      )
    }

    // Delete existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: normalizedEmail },
    })

    // Generate new reset token
    const token = generateResetToken()
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY)

    await prisma.passwordResetToken.create({
      data: {
        token,
        email: normalizedEmail,
        expiresAt,
      },
    })

    const requestUrl = new URL(req.url)
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      requestUrl.origin
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`

    try {
      await sendPasswordResetEmail({
        to: normalizedEmail,
        resetUrl,
      })
    } catch (mailError) {
      const isDev = process.env.NODE_ENV === "development"
      if (isDev) {
        console.warn("[Password Reset Email Fallback]", {
          email: normalizedEmail,
          resetUrl,
          reason: mailError instanceof Error ? mailError.message : String(mailError),
        })
      } else {
        throw mailError
      }
    }

    return NextResponse.json(
      { message: "If email exists, reset link will be sent" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Password Reset API Error]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
