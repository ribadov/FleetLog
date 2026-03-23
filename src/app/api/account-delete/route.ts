import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"

export async function DELETE(req: Request) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { password } = await req.json() as { password: string | undefined }

    if (!password || String(password).trim() === "") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(String(password), user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    // Delete user account (cascade deletion will handle related records)
    await prisma.user.delete({
      where: { id: user.id },
    })

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Konto kann nicht gelöscht werden, solange verknüpfte Daten vorhanden sind." },
        { status: 409 }
      )
    }

    console.error("[Account Delete API Error]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
