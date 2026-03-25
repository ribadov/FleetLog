import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	outputFileTracingIncludes: {
		"/*": [
			"./node_modules/.prisma/client/**/*",
			"./node_modules/@prisma/client/**/*",
			"./prisma/dev.db",
			"./prisma/prisma/dev.db",
		],
	},
};

export default nextConfig;
