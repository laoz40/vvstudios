import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { collectLoaderAndThenNodes } from "../shared/loaders.ts";
import { isConvexLibFile } from "../shared/paths.ts";

type ReportContext = {
	report: (options: { node: ESTree.Node; messageId: "loaderOrchestration" }) => void;
};

function reportLoaderOrchestration(
	context: ReportContext,
	body: ESTree.BlockStatement | ESTree.Expression | null | undefined
) {
	if (body === null || body === undefined) {
		return;
	}

	for (const match of collectLoaderAndThenNodes(body)) {
		context.report({ node: match, messageId: "loaderOrchestration" });
	}
}

/** Lib exports must not load a row then branch/patch/mutate in the same function. */
export const noLibLoaderOrchestrationRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow exported convex/lib functions that call a loader (get*/load*/list* or okOrThrow db read) and chain domain work via .andThen."
		},
		messages: {
			loaderOrchestration:
				"Do not orchestrate loader.andThen(work) in convex/lib. Split into a loader-only lib helper and a service that chains the steps."
		}
	},
	create(context) {
		if (!isConvexLibFile(context.filename)) {
			return {};
		}

		return {
			ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
				if (node.declaration?.type === "FunctionDeclaration") {
					reportLoaderOrchestration(context, node.declaration.body);

					return;
				}

				if (node.declaration?.type !== "VariableDeclaration") {
					return;
				}

				for (const declarator of node.declaration.declarations) {
					if (declarator.init === null) {
						continue;
					}

					if (
						declarator.init.type === "FunctionExpression" ||
						declarator.init.type === "ArrowFunctionExpression"
					) {
						reportLoaderOrchestration(context, declarator.init.body);
					}
				}
			}
		};
	}
});
