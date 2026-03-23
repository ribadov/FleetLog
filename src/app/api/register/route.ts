import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { resolveLocale } from "@/lib/i18n"

export const runtime = "nodejs"

const RESERVED_ADMIN_EMAIL = "info@karr-logistik.com"

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

function generateWorkspaceCode() {
  return `WS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function createUniqueWorkspaceCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateWorkspaceCode()
    const existing = await prisma.workspace.findUnique({ where: { code } })
    if (!existing) return code
  }
  throw new Error("Could not generate unique workspace code")
}

export async function POST(req: Request) {
  try {
    const {
      name,
      email,
      password,
      role,
      phoneNumber,
      preferredLanguage,
      workspaceCode,
      companyName,
      companyStreet,
      companyHouseNumber,
      companyPostalCode,
      companyCity,
      companyCountry,
      billingEmail,
      vatId,
      taxNumber,
      bankName,
      bankAccountHolder,
      iban,
      bic,
    } = await req.json()

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedLanguage = resolveLocale(preferredLanguage)
    const normalizedPhoneNumber = phoneNumber ? String(phoneNumber).trim() : null

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    if (normalizedEmail === RESERVED_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "This email is reserved for the platform administrator" },
        { status: 403 }
      )
    }

    if (!["DRIVER", "CONTRACTOR", "MANAGER"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be DRIVER, CONTRACTOR or MANAGER" },
        { status: 400 }
      )
    }

    if (role === "DRIVER" && (!workspaceCode || String(workspaceCode).trim() === "")) {
      return NextResponse.json(
        { error: "Workspace code is required for DRIVER" },
        { status: 400 }
      )
    }

    if (role === "CONTRACTOR") {
      const requiredContractorFields = [
        companyName,
        companyStreet,
        companyHouseNumber,
        companyPostalCode,
        companyCity,
        companyCountry,
        vatId,
        taxNumber,
      ]

      if (requiredContractorFields.some((value) => !value || String(value).trim() === "")) {
        return NextResponse.json(
          { error: "All contractor company and tax fields are required" },
          { status: 400 }
        )
      }
    }

    if (role === "MANAGER") {
      const requiredManagerFields = [
        companyName,
        companyStreet,
        companyHouseNumber,
        companyPostalCode,
        companyCity,
        companyCountry,
        vatId,
        taxNumber,
        bankName,
        bankAccountHolder,
        iban,
        bic,
      ]

      if (requiredManagerFields.some((value) => !value || String(value).trim() === "")) {
        return NextResponse.json(
          { error: "All manager company, tax and bank fields are required" },
          { status: 400 }
        )
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    if (role === "MANAGER") {
      const workspaceCodeValue = await createUniqueWorkspaceCode()
      const workspaceName = companyName?.trim() || `${name}'s Workspace`

      const createdManager = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          phoneNumber: normalizedPhoneNumber,
          preferredLanguage: normalizedLanguage,
          password: hashedPassword,
          role,
          companyName,
          companyStreet,
          companyHouseNumber,
          companyPostalCode,
          companyCity,
          companyCountry,
          vatId,
          taxNumber,
          bankName,
          bankAccountHolder,
          iban,
          bic,
        },
      })

      let createdWorkspaceId: string | null = null

      try {
        const workspace = await prisma.workspace.create({
          data: {
            name: workspaceName,
            code: workspaceCodeValue,
            managerId: createdManager.id,
          },
        })

        createdWorkspaceId = workspace.id

        await prisma.user.update({
          where: { id: createdManager.id },
          data: { workspaceId: workspace.id },
        })

        return NextResponse.json(
          {
            message: "Manager created successfully",
            workspaceCode: workspace.code,
          },
          { status: 201 }
        )
      } catch (managerSetupError) {
        if (createdWorkspaceId) {
          await prisma.workspace.delete({ where: { id: createdWorkspaceId } }).catch(() => null)
        }

        await prisma.user.delete({ where: { id: createdManager.id } }).catch(() => null)
        throw managerSetupError
      }
    }

    let workspaceId: string | null = null
    if (role === "DRIVER") {
      const normalizedWorkspaceCode = normalizeCode(String(workspaceCode))
      const workspace = await prisma.workspace.findUnique({ where: { code: normalizedWorkspaceCode } })
      if (!workspace) {
        return NextResponse.json(
          { error: "Invalid workspace code" },
          { status: 400 }
        )
      }

      workspaceId = workspace.id
    }

    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phoneNumber: normalizedPhoneNumber,
        preferredLanguage: normalizedLanguage,
        password: hashedPassword,
        role,
        companyName: role === "CONTRACTOR" ? companyName : null,
        companyStreet: role === "CONTRACTOR" ? companyStreet : null,
        companyHouseNumber: role === "CONTRACTOR" ? companyHouseNumber : null,
        companyPostalCode: role === "CONTRACTOR" ? companyPostalCode : null,
        companyCity: role === "CONTRACTOR" ? companyCity : null,
        companyCountry: role === "CONTRACTOR" ? companyCountry : null,
        billingEmail: role === "CONTRACTOR" ? (billingEmail ? String(billingEmail).trim() : null) : null,
        vatId: role === "CONTRACTOR" ? vatId : null,
        taxNumber: role === "CONTRACTOR" ? taxNumber : null,
        bankName: null,
        bankAccountHolder: null,
        iban: null,
        bic: null,
        workspaceId,
      },
    })

    return NextResponse.json({ message: "User created successfully" }, { status: 201 })
  } catch (error) {
    const errorObj = error as unknown
    let errorMessage = "Unknown error"
    let errorStack = ""

    if (errorObj instanceof Error) {
      errorMessage = errorObj.message
      errorStack = errorObj.stack || ""
    } else if (typeof errorObj === "string") {
      errorMessage = errorObj
    } else if (typeof errorObj === "object" && errorObj !== null) {
      errorMessage = JSON.stringify(errorObj)
    }

    const logData = {
      message: errorMessage,
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "unknown",
      meta:
        error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : null,
      constructorName: errorObj?.constructor?.name,
      hasStack: !!errorStack,
    }

    console.error("[Register API Error]", JSON.stringify(logData))
    console.error("[Register API Stack]", errorStack)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 })
      }

      if (error.code === "P2022") {
        return NextResponse.json(
          { error: "Database schema is outdated. Please run Prisma migrations." },
          { status: 500 }
        )
      }

      // Log other Prisma errors
      console.error("[Register API - Prisma Error Code]", error.code, error.message)
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
