import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { resolveLocale } from "@/lib/i18n"

export async function GET() {
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        preferredLanguage: true,
        role: true,
        companyName: true,
        companyStreet: true,
        companyHouseNumber: true,
        companyPostalCode: true,
        companyCity: true,
        companyCountry: true,
        billingEmail: true,
        vatId: true,
        taxNumber: true,
        bankName: true,
        bankAccountHolder: true,
        iban: true,
        bic: true,
        invoiceEmailSubject: true,
        invoiceEmailBody: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Profile GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      name,
      phoneNumber,
      preferredLanguage,
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
      currentPassword,
      newPassword,
      invoiceEmailSubject,
      invoiceEmailBody,
    } = await req.json() as Record<string, string | null | undefined>

    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    // Validate password change if provided
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password" },
          { status: 400 }
        )
      }

      const passwordValid = await bcrypt.compare(currentPassword, user.password)
      if (!passwordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        )
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters" },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, string | null> = {}

    if (user.role === "MANAGER") {
      if (invoiceEmailSubject !== undefined) {
        updateData.invoiceEmailSubject = invoiceEmailSubject?.trim() || null
      }
      if (invoiceEmailBody !== undefined) {
        updateData.invoiceEmailBody = invoiceEmailBody?.trim() || null
      }
    }
    
    if (name !== undefined && name?.trim()) {
      updateData.name = name.trim()
    }
    
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber ? phoneNumber.trim() : null
    }
    
    if (preferredLanguage !== undefined) {
      updateData.preferredLanguage = resolveLocale(preferredLanguage)
    }
    
    // Update company fields if user is CONTRACTOR or MANAGER
    if (user.role === "CONTRACTOR" || user.role === "MANAGER") {
      if (companyName !== undefined) {
        updateData.companyName = companyName?.trim() || null
      }
      if (companyStreet !== undefined) {
        updateData.companyStreet = companyStreet?.trim() || null
      }
      if (companyHouseNumber !== undefined) {
        updateData.companyHouseNumber = companyHouseNumber?.trim() || null
      }
      if (companyPostalCode !== undefined) {
        updateData.companyPostalCode = companyPostalCode?.trim() || null
      }
      if (companyCity !== undefined) {
        updateData.companyCity = companyCity?.trim() || null
      }
      if (companyCountry !== undefined) {
        updateData.companyCountry = companyCountry?.trim() || null
      }
      if (billingEmail !== undefined) {
        updateData.billingEmail = billingEmail?.trim() || null
      }
      if (vatId !== undefined) {
        updateData.vatId = vatId?.trim() || null
      }
      if (taxNumber !== undefined) {
        updateData.taxNumber = taxNumber?.trim() || null
      }
    }

    // Update bank fields if user is MANAGER
    if (user.role === "MANAGER") {
      if (bankName !== undefined) {
        updateData.bankName = bankName?.trim() || null
      }
      if (bankAccountHolder !== undefined) {
        updateData.bankAccountHolder = bankAccountHolder?.trim() || null
      }
      if (iban !== undefined) {
        updateData.iban = iban?.trim() || null
      }
      if (bic !== undefined) {
        updateData.bic = bic?.trim() || null
      }
    }

    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id as string },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        preferredLanguage: true,
        role: true,
        companyName: true,
        companyStreet: true,
        companyHouseNumber: true,
        companyPostalCode: true,
        companyCity: true,
        companyCountry: true,
        billingEmail: true,
        vatId: true,
        taxNumber: true,
        bankName: true,
        bankAccountHolder: true,
        iban: true,
        bic: true,
        invoiceEmailSubject: true,
        invoiceEmailBody: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 })
      }
    }

    console.error("Profile PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
