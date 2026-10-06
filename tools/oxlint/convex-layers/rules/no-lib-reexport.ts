import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { isConvexLibImport, isConvexServiceFile } from "../shared/paths.ts";

function getLocalBindingName(specifier: ESTree.ExportSpecifier): string | null {
	if (specifier.local.type === "Identifier") {
		return specifier.local.name;
	}

	return null;
}

function getExportedName(specifier: ESTree.ExportSpecifier): string {
	if (specifier.exported.type === "Identifier") {
		return specifier.exported.name;
	}

	return specifier.exported.value;
}

/** Track lib imports that are re-exported unchanged from service modules. */
export const noLibReexportRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow re-exporting convex/lib symbols from convex/services (export { … } from lib or export { imported })."
		},
		messages: {
			libReexportFrom:
				"Do not re-export convex/lib from a service file. Import lib inside the service step that needs it, or expose a real service function.",
			libReexportBinding:
				"Do not re-export a symbol imported from convex/lib. Call it inside a named service function instead."
		}
	},
	create(context) {
		if (!isConvexServiceFile(context.filename)) {
			return {};
		}

		const libImportedBindings = new Set<string>();

		return {
			ImportDeclaration(node: ESTree.ImportDeclaration) {
				if (!isConvexLibImport(node.source.value)) {
					return;
				}

				for (const specifier of node.specifiers) {
					if (specifier.type === "ImportSpecifier" && specifier.local.type === "Identifier") {
						libImportedBindings.add(specifier.local.name);
					}

					if (specifier.type === "ImportDefaultSpecifier") {
						libImportedBindings.add(specifier.local.name);
					}

					if (specifier.type === "ImportNamespaceSpecifier") {
						libImportedBindings.add(specifier.local.name);
					}
				}
			},
			ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
				if (node.source !== null && isConvexLibImport(node.source.value)) {
					context.report({ node, messageId: "libReexportFrom" });

					return;
				}

				if (node.declaration !== null || node.specifiers.length === 0) {
					return;
				}

				for (const specifier of node.specifiers) {
					const localName = getLocalBindingName(specifier);

					if (localName === null || !libImportedBindings.has(localName)) {
						continue;
					}

					const exportedName = getExportedName(specifier);

					if (exportedName === localName) {
						context.report({ node: specifier, messageId: "libReexportBinding" });
					}
				}
			}
		};
	}
});
