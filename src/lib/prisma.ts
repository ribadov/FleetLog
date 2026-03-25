import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql/web"
import { getCloudflareContext } from "@opennextjs/cloudflare"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function readProcessEnv(name: string) {
	const processRef = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
	return processRef?.env?.[name]
}

function readCloudflareEnv(name: string) {
	try {
		const context = getCloudflareContext()
		const value = (context?.env as Record<string, unknown> | undefined)?.[name]
		return typeof value === "string" ? value : undefined
	} catch {
		return undefined
	}
}

function resolveRuntimeDatabaseUrl() {
	const isDevelopment = readProcessEnv("NODE_ENV") === "development"
	const runtimeDatabaseUrl = isDevelopment
		? readProcessEnv("DATABASE_URL") ||
			readProcessEnv("TURSO_DATABASE_URL") ||
			readProcessEnv("LIBSQL_URL") ||
			readCloudflareEnv("DATABASE_URL") ||
			readCloudflareEnv("TURSO_DATABASE_URL") ||
			readCloudflareEnv("LIBSQL_URL")
		: readCloudflareEnv("DATABASE_URL") ||
			readCloudflareEnv("TURSO_DATABASE_URL") ||
			readCloudflareEnv("LIBSQL_URL")

	if (runtimeDatabaseUrl?.startsWith("file:") && !isDevelopment) {
		throw new Error(
			`[Prisma] Invalid DATABASE_URL for production runtime: "${runtimeDatabaseUrl}". ` +
				'Use a libsql/http/ws URL (e.g. "libsql://<db>.turso.io") and set it in Cloudflare env vars.'
		)
	}

	return runtimeDatabaseUrl
}

function createPrismaClient() {
	const isDevelopment = readProcessEnv("NODE_ENV") === "development"
	const runtimeDatabaseUrl =
		resolveRuntimeDatabaseUrl() ||
		(isDevelopment ? "file:./prisma/dev.db" : undefined)

	if (!runtimeDatabaseUrl) {
		throw new Error(
			"[Prisma] DATABASE_URL is missing. Configure DATABASE_URL (and DATABASE_AUTH_TOKEN for Turso/libSQL) in production."
		)
	}

	const authToken = isDevelopment
		? readProcessEnv("DATABASE_AUTH_TOKEN") ||
			readProcessEnv("TURSO_AUTH_TOKEN") ||
			readCloudflareEnv("DATABASE_AUTH_TOKEN") ||
			readCloudflareEnv("TURSO_AUTH_TOKEN")
		: readCloudflareEnv("DATABASE_AUTH_TOKEN") || readCloudflareEnv("TURSO_AUTH_TOKEN")

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
