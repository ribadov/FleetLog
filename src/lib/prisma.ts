import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql/web"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function resolveRuntimeDatabaseUrl() {
	return process.env.DATABASE_URL
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
