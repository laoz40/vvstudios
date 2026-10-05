import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { isConvexServiceFile } from "../shared/paths.ts";

const CHAIN_METHOD_NAMES = new Set(["andThen", "asyncAndThen", "map"]);

function isResultChainCall(node: ESTree.CallExpression): boolean {
	const callee = node.callee;
	if (callee.type !== "MemberExpression") {
		return false;
	}

	if (callee.computed || callee.property.type !== "Identifier") {
		return false;
	}

	return CHAIN_METHOD_NAMES.has(callee.property.name);
}

function isInlineCallback(node: ESTree.Expression | ESTree.SpreadElement): boolean {
	if (node.type === "SpreadElement") {
		return false;
	}

	return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";
}

/** Service Result chains must use named steps or curried calls, not inline callbacks. */
export const noInlineCallbackInServiceChainsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow inline arrow or function callbacks as the first argument to .andThen, .asyncAndThen, or .map in convex/services/**."
		},
		messages: {
			inlineCallback:
				"Use a named function reference or curried call (foo(ctx, args)), not an inline callback, in service Result chains."
		}
	},
	create(context) {
		if (!isConvexServiceFile(context.filename)) {
			return {};
		}

		return {
			CallExpression(node: ESTree.CallExpression) {
				if (!isResultChainCall(node)) {
					return;
				}

				const firstArg = node.arguments[0];
				if (firstArg === undefined) {
					return;
				}

				if (!isInlineCallback(firstArg)) {
					return;
				}

				context.report({ node: firstArg, messageId: "inlineCallback" });
			}
		};
	}
});
