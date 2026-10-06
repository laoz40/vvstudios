import { posix } from "node:path";
import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

function isLibTestFile(filename: string): boolean {
	return /(?:^|\/)convex\/lib\/tests\//u.test(filename.replaceAll("\\", "/"));
}

function importsConvexTestSetup(filename: string, source: string): boolean {
	const normalizedFilename = filename.replaceAll("\\", "/");
	const isConvexAlias = source.startsWith("#convex/");
	if (!isConvexAlias && !source.startsWith(".")) return false;

	const filenameParts = normalizedFilename.split("/");
	const baseParts = isConvexAlias ? ["convex"] : filenameParts.slice(0, -1);
	const importPath = isConvexAlias ? source.slice("#convex/".length) : source;
	const resolved = posix.normalize([...baseParts, importPath].join("/"));

	return /(?:^|\/)convex\/test\.setup(?:\.[cm]?[jt]sx?)?$/u.test(resolved);
}

function importSource(node: ESTree.Node): string | null {
	if (
		node.type === "ImportDeclaration" ||
		node.type === "ExportNamedDeclaration" ||
		node.type === "ExportAllDeclaration"
	) {
		return node.source?.value ?? null;
	}

	if (node.type === "ImportExpression" && node.source.type === "Literal") {
		return typeof node.source.value === "string" ? node.source.value : null;
	}

	return null;
}

/** Keep Convex integration-test setup out of pure convex/lib tests. */
export const noLibTestSetupImportRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Disallow importing convex/test.setup from convex/lib/tests/**."
		},
		messages: {
			libTestSetupImport:
				"Pure convex/lib tests must not import convex/test.setup. Move integration coverage to convex/tests/**."
		}
	},
	create(context) {
		if (!isLibTestFile(context.filename)) return {};

		function checkImport(node: ESTree.Node) {
			const source = importSource(node);
			if (source !== null && importsConvexTestSetup(context.filename, source)) {
				context.report({ node, messageId: "libTestSetupImport" });
			}
		}

		return {
			ImportDeclaration: checkImport,
			ExportNamedDeclaration: checkImport,
			ExportAllDeclaration: checkImport,
			ImportExpression: checkImport
		};
	}
});
