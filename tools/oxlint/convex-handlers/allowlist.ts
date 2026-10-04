/**
 * Root `convex/*.ts` files that still import non-schema `#convex/lib/**` during migration.
 * Remove a path when the handler delegates to `convex/services/**` instead.
 * See `README.md`.
 */
export const ROOT_HANDLER_LIB_IMPORT_ALLOWLIST = new Set([
	"convex/devSeed.ts",
	"convex/packageAdjustments.ts",
	"convex/packageScheduling.ts",
	"convex/packages.ts",
	"convex/sessionCheckout.ts",
	"convex/sessionReminders.ts",
	"convex/sessionScheduling.ts",
	"convex/sessions.ts"
]);
