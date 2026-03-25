import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql"
import fs from "node:fs"
import path from "node:path"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

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
	const runtimeDatabaseUrl =
		resolveRuntimeDatabaseUrl() ||
		(process.env.NODE_ENV === "development" ? "file:./prisma/dev.db" : undefined)

	if (!runtimeDatabaseUrl) {
		throw new Error(
			"[Prisma] DATABASE_URL is missing. Configure DATABASE_URL (and DATABASE_AUTH_TOKEN for Turso/libSQL) in production."
		)
	}

	const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

	const adapter = new PrismaLibSQL({
		url: runtimeDatabaseUrl,
		authToken,
	})

	return new PrismaClient({ adapter })
}

function getPrismaClient() {
	if (!globalForPrisma.prisma) {
		globalForPrisma.prisma = createPrismaClient()
	}

	return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
	get(_target, property, receiver) {
		const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>
		const value = Reflect.get(client, property, receiver)

		if (typeof value === "function") {
			return (value as (...args: unknown[]) => unknown).bind(client)
		}

		return value
	},
}) as PrismaClient
