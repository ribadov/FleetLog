import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type Params = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "ADMIN") {
    return NextResponse.json({ error: "Admins are read-only" }, { status: 403 });
  }

  const { id } = await params;
  const { isAdmin, workspaceId } = getTenantContext(session.user);

  const transport = await prisma.transport.findUnique({ where: { id } });
  if (!transport) {
    return NextResponse.json({ error: "Transport not found" }, { status: 404 });
  }

  if (!isAdmin) {
    if (session.user.role === "CONTRACTOR") {
      if (transport.contractorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (transport.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const canUpload =
    session.user.role === "MANAGER" ||
    (session.user.role === "CONTRACTOR" && transport.contractorId === session.user.id);

  if (!canUpload) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "PDF must be <= 10MB" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "freight-letters");
  await fs.mkdir(uploadsDir, { recursive: true });

  const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${transport.id}-${Date.now()}-${safeOriginal}`;
  const filePath = path.join(uploadsDir, fileName);

  const bytes = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(bytes));

  if (transport.freightLetterPath) {
    const previousAbsolute = path.join(process.cwd(), "public", transport.freightLetterPath);
    await fs.unlink(previousAbsolute).catch(() => {});
  }

  const publicPath = `/uploads/freight-letters/${fileName}`;

  await prisma.transport.update({
    where: { id: transport.id },
    data: { freightLetterPath: publicPath },
  });

  return NextResponse.json({ path: publicPath });
}
