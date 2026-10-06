import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { isConvexHandlerFile, isConvexLibImport } from "../shared/paths.ts";

/** Handlers at `convex/*.ts` must call services, not import `#convex/lib/**` directly. */
export const noHandlerLibImportRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow #convex/lib imports in top-level Convex handler modules (convex/*.ts)."
		},
		messages: {
			handlerLibImport:
				"Handlers must not import from #convex/lib. Compose a service step and import from #convex/services/** instead."
		}
	},
	create(context) {
		if (!isConvexHandlerFile(context.filename)) {
			return {};
		}

		return {
			ImportDeclaration(node: ESTree.ImportDeclaration) {
				if (!isConvexLibImport(node.source.value)) {
					return;
				}

				context.report({ node, messageId: "handlerLibImport" });
			}
		};
	}
});
