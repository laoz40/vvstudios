import { defineRule } from "@oxlint/plugins";

import { ROOT_HANDLER_LIB_IMPORT_ALLOWLIST } from "../allowlist.ts";

const ROOT_CONVEX_HANDLER = /(?:^|\/)convex\/[^/]+\.ts$/u;

function normalizePath(filename: string): string {
	return filename.replaceAll("\\", "/");
}

function isRootConvexHandlerFile(filename: string): boolean {
	return ROOT_CONVEX_HANDLER.test(normalizePath(filename));
}

function projectRelativePath(filename: string): string | null {
	const normalized = normalizePath(filename);
	const workspaceSuffix = normalized.match(/(?:^|\/)convex\/[^/]+\.ts$/u)?.[0];

	if (workspaceSuffix === undefined) {
		return null;
	}

	return workspaceSuffix.startsWith("/") ? workspaceSuffix.slice(1) : workspaceSuffix;
}

function isConvexLibImport(source: string): boolean {
	return source === "#convex/lib" || source.startsWith("#convex/lib/");
}

/** Root Convex API modules must not import domain logic from `convex/lib`; use services instead. */
export const noRootLibImportRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow `#convex/lib/**` imports in top-level `convex/*.ts` handler modules (value and type-only imports)."
		},
		messages: {
			rootLibImport:
				'Root Convex handler `{{source}}` is not allowed here. Call `convex/services/**` from top-level `convex/*.ts` files instead of importing `convex/lib`.'
		}
	},
	create(context) {
		const relativePath = projectRelativePath(context.filename);
		const isAllowlisted =
			relativePath !== null && ROOT_HANDLER_LIB_IMPORT_ALLOWLIST.has(relativePath);

		return {
			ImportDeclaration(node) {
				if (!isRootConvexHandlerFile(context.filename) || isAllowlisted) {
					return;
				}

				const source = node.source.value;

				if (typeof source !== "string" || !isConvexLibImport(source)) {
					return;
				}

				context.report({
					node,
					messageId: "rootLibImport",
					data: { source }
				});
			},
			ExportNamedDeclaration(node) {
				if (!isRootConvexHandlerFile(context.filename) || isAllowlisted) {
					return;
				}

				if (node.source === null) {
					return;
				}

				const source = node.source.value;

				if (typeof source !== "string" || !isConvexLibImport(source)) {
					return;
				}

				context.report({
					node,
					messageId: "rootLibImport",
					data: { source }
				});
			},
			ExportAllDeclaration(node) {
				if (!isRootConvexHandlerFile(context.filename) || isAllowlisted) {
					return;
				}

				const source = node.source.value;

				if (typeof source !== "string" || !isConvexLibImport(source)) {
					return;
				}

				context.report({
					node,
					messageId: "rootLibImport",
					data: { source }
				});
			}
		};
	}
});
