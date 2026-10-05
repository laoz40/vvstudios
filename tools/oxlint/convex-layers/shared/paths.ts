const LIB_IMPORT_PREFIX = "#convex/lib/";

export function isConvexLibImport(source: string): boolean {
	return source === "#convex/lib" || source.startsWith(LIB_IMPORT_PREFIX);
}

export function isConvexServiceFile(filename: string): boolean {
	return /\/convex\/services\//u.test(filename.replaceAll("\\", "/"));
}

const HANDLER_LIB_IMPORT_ALLOWLIST = new Set([
	"convex/http.ts",
	"convex/devSeed.ts",
	"convex/schema.ts",
	"convex/env.ts",
	"convex/test.setup.ts",
	"convex/auth.config.ts",
	"convex/convex.config.ts",
	"convex/crons.ts"
]);

export function isConvexHandlerFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");
	const match = /\/convex\/([^/]+\.ts)$/u.exec(normalized);

	if (match === null) {
		return false;
	}

	const convexRelative = `convex/${match[1]}`;

	return !HANDLER_LIB_IMPORT_ALLOWLIST.has(convexRelative);
}
