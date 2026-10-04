import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { ROOT_HANDLER_LIB_IMPORT_ALLOWLIST } from "../allowlist.ts";

const ROOT_CONVEX_HANDLER = /(?:^|\/)convex\/[^/]+\.ts$/u;

const SCHEMA_EXPORT_NAME = /Validator$/u;

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

function isTypeOnlyImportDeclaration(node: ESTree.ImportDeclaration): boolean {
	return node.importKind === "type";
}

function getImportSpecifierName(
	specifier: ESTree.ImportSpecifier | ESTree.ImportDefaultSpecifier | ESTree.ImportNamespaceSpecifier
): string | null {
	if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
		return null;
	}

	if (specifier.imported.type === "Identifier") {
		return specifier.imported.name;
	}

	return specifier.imported.value;
}

function isSchemaImportSpecifier(
	specifier: ESTree.ImportSpecifier | ESTree.ImportDefaultSpecifier | ESTree.ImportNamespaceSpecifier
): boolean {
	if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
		return false;
	}

	if (specifier.importKind === "type") {
		return true;
	}

	const importedName = getImportSpecifierName(specifier);

	return importedName !== null && SCHEMA_EXPORT_NAME.test(importedName);
}

function isSchemaOnlyImportDeclaration(node: ESTree.ImportDeclaration): boolean {
	if (isTypeOnlyImportDeclaration(node)) {
		return true;
	}

	if (node.specifiers.length === 0) {
		return false;
	}

	return node.specifiers.every((specifier) => isSchemaImportSpecifier(specifier));
}

function isSchemaOnlyExportNamedDeclaration(node: ESTree.ExportNamedDeclaration): boolean {
	if (node.exportKind === "type") {
		return true;
	}

	if (node.declaration !== null || node.specifiers.length === 0) {
		return false;
	}

	return node.specifiers.every((specifier) => {
		if (specifier.exportKind === "type") {
			return true;
		}

		const exportedName =
			specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value;

		return SCHEMA_EXPORT_NAME.test(exportedName);
	});
}

/** Root Convex API modules must not import domain logic from `convex/lib`; use services instead. */
export const noRootLibImportRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow non-schema `#convex/lib/**` imports in top-level `convex/*.ts` handler modules. Schema-only imports (`*Validator`, `import type`) are allowed for handler `args`."
		},
		messages: {
			rootLibImport:
				'Root Convex handler `{{source}}` is not allowed here. Call `convex/services/**` from top-level `convex/*.ts` files instead of importing `convex/lib` domain logic.'
		}
	},
	create(context) {
		const relativePath = projectRelativePath(context.filename);
		const isAllowlisted =
			relativePath !== null && ROOT_HANDLER_LIB_IMPORT_ALLOWLIST.has(relativePath);

		function shouldReportLibImport(
			node: ESTree.ImportDeclaration | ESTree.ExportNamedDeclaration | ESTree.ExportAllDeclaration
		): boolean {
			if (!isRootConvexHandlerFile(context.filename) || isAllowlisted) {
				return false;
			}

			const source = node.source?.value;

			if (typeof source !== "string" || !isConvexLibImport(source)) {
				return false;
			}

			if (node.type === "ImportDeclaration") {
				return !isSchemaOnlyImportDeclaration(node);
			}

			if (node.type === "ExportNamedDeclaration") {
				return !isSchemaOnlyExportNamedDeclaration(node);
			}

			return true;
		}

		return {
			ImportDeclaration(node) {
				if (!shouldReportLibImport(node)) {
					return;
				}

				context.report({
					node,
					messageId: "rootLibImport",
					data: { source: node.source.value }
				});
			},
			ExportNamedDeclaration(node) {
				if (node.source === null || !shouldReportLibImport(node)) {
					return;
				}

				context.report({
					node,
					messageId: "rootLibImport",
					data: { source: node.source.value }
				});
			},
			ExportAllDeclaration(node) {
				if (!shouldReportLibImport(node)) {
					return;
				}

				context.report({
					node,
					messageId: "rootLibImport",
					data: { source: node.source.value }
				});
			}
		};
	}
});
