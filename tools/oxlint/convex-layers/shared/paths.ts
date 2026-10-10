const LIB_IMPORT_PREFIX = "#convex/lib/";

export function isConvexLibImport(source: string): boolean {
	return source === "#convex/lib" || source.startsWith(LIB_IMPORT_PREFIX);
}

const FEATURE_LAYER_SEGMENT = /\/convex\/[^/]+\/(?:services|lib)\//u;

export function isConvexServiceFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");

	return /\/convex\/services\//u.test(normalized) || /\/convex\/[^/]+\/services\//u.test(normalized);
}

export function isConvexLibFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");

	return /\/convex\/lib\//u.test(normalized) || /\/convex\/[^/]+\/lib\//u.test(normalized);
}

const HANDLER_LIB_IMPORT_ALLOWLIST = new Set([
	"convex/sessionsDriveInternal.ts",
	"convex/http.ts",
	"convex/devSeed.ts",
	"convex/schema.ts",
	"convex/env.ts",
	"convex/test.setup.ts",
	"convex/auth.config.ts",
	"convex/convex.config.ts",
	"convex/crons.ts"
]);

const FEATURE_NON_HANDLER_DIRS = new Set(["services", "lib", "tests", "shared"]);

export function isConvexHandlerFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");
	const rootMatch = /\/convex\/([^/]+\.ts)$/u.exec(normalized);

	if (rootMatch !== null) {
		const convexRelative = `convex/${rootMatch[1]}`;

		return !HANDLER_LIB_IMPORT_ALLOWLIST.has(convexRelative);
	}

	const featureMatch = /\/convex\/([^/]+)\/([^/]+\.ts)$/u.exec(normalized);

	if (featureMatch === null) {
		return false;
	}

	const featureDir = featureMatch[1] ?? "";

	if (featureDir === "" || FEATURE_NON_HANDLER_DIRS.has(featureDir)) {
		return false;
	}

	return !FEATURE_LAYER_SEGMENT.test(normalized);
}
