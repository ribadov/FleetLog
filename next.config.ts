import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ["@prisma/client", "prisma", "@prisma/engines"],
	outputFileTracingIncludes: {
		"/*": [
			"./node_modules/.prisma/client/**/*",
			"./node_modules/@prisma/client/**/*",
			"./node_modules/@prisma/engines/**/*",
			"./prisma/dev.db",
			"./prisma/prisma/dev.db",
		],
	},
};

export default nextConfig;
