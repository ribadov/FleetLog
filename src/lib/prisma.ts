import { PrismaClient } from "@prisma/client"
import fs from "node:fs"
import path from "node:path"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function resolveRuntimeDatabaseUrl() {
	const configuredUrl = process.env.DATABASE_URL
	const isNetlify = process.env.NETLIFY === "true"
	const isRelativeSqlite = configuredUrl?.startsWith("file:./")

	if (!isNetlify || !configuredUrl || !isRelativeSqlite) {
		return configuredUrl
	}

	const configuredPath = configuredUrl.replace("file:", "")
	const candidates = [
		path.resolve(process.cwd(), configuredPath),
		path.join(process.cwd(), "prisma", "prisma", "dev.db"),
		path.join(process.cwd(), "prisma", "dev.db"),
	]
	const sourceDbAbsolutePath = candidates.find((candidate) => {
		try {
			return fs.existsSync(candidate) && fs.statSync(candidate).size > 0
		} catch {
			return false
		}
	})
	const writableDbAbsolutePath = "/tmp/fleetlog.db"

	try {
		if (!fs.existsSync(writableDbAbsolutePath)) {
			if (sourceDbAbsolutePath && fs.existsSync(sourceDbAbsolutePath)) {
				fs.copyFileSync(sourceDbAbsolutePath, writableDbAbsolutePath)
			} else {
				console.warn(
					`[Prisma] Source SQLite DB not found in candidates: ${candidates.join(", ")}. ` +
						"Netlify runtime may fail if schema is missing."
				)
			}
		}
	} catch (error) {
		console.error("[Prisma] Failed to prepare writable SQLite database in /tmp", error)
	}

	return `file:${writableDbAbsolutePath}`
}

function createPrismaClient() {
	const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl()

	if (runtimeDatabaseUrl) {
		return new PrismaClient({
			datasources: {
				db: {
					url: runtimeDatabaseUrl,
				},
			},
		})
	}

	return new PrismaClient()
}

export const prisma = globalForPrisma.prisma || createPrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
