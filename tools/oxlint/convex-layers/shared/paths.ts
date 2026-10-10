const LIB_IMPORT_PREFIX = "#convex/lib/";

export function isConvexLibImport(source: string): boolean {
	if (source === "#convex/lib" || source.startsWith(LIB_IMPORT_PREFIX)) {
		return true;
	}

	if (source.startsWith("#convex/shared/lib")) {
		return true;
	}

	return /#convex\/[^/]+\/lib(?:\/|$)/u.test(source);
}

const FEATURE_LAYER_SEGMENT = /\/convex\/(?:[^/]+|shared)\/(?:services|lib)\//u;

export function isConvexServiceFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");

	return (
		/\/convex\/services\//u.test(normalized) ||
		/\/convex\/[^/]+\/services\//u.test(normalized) ||
		/\/convex\/shared\/services\//u.test(normalized)
	);
}

export function isConvexLibFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");

	return (
		/\/convex\/lib\//u.test(normalized) ||
		/\/convex\/[^/]+\/lib\//u.test(normalized) ||
		/\/convex\/shared\/lib\//u.test(normalized)
	);
}

const HANDLER_LIB_IMPORT_ALLOWLIST = new Set([
	"convex/sessions/drive.ts",
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
	const featureFile = featureMatch[2] ?? "";
	const featureRelative = `convex/${featureDir}/${featureFile}`;

	if (featureDir === "" || FEATURE_NON_HANDLER_DIRS.has(featureDir)) {
		return false;
	}

	if (HANDLER_LIB_IMPORT_ALLOWLIST.has(featureRelative)) {
		return false;
	}

	return !FEATURE_LAYER_SEGMENT.test(normalized);
}
