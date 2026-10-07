import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { isConvexServiceFile } from "../shared/paths.ts";
import {
	collectLocalFunctions,
	isCurriedFactoryFunction,
	isPassThroughNamedCall,
	resolveCalleeToLocal
} from "../shared/service-chain-callbacks.ts";

const CHAIN_METHOD_NAMES = new Set(["andThen", "asyncAndThen"]);

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

function isCurriedFactoryCall(
	node: ESTree.CallExpression,
	locals: Map<
		string,
		ReturnType<typeof collectLocalFunctions> extends Map<string, infer V> ? V : never
	>
): boolean {
	const calleeFn = resolveCalleeToLocal(node, locals);

	return calleeFn !== null && isCurriedFactoryFunction(calleeFn);
}

/** Service Result chains use named steps or forwarding calls without inline decisions. */
export const noInlineCallbackInServiceChainsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Allow only named functions and pass-through calls as the first argument to .andThen or .asyncAndThen in convex/services/**."
		},
		messages: {
			inlineCallback:
				"Use a named function reference or a pass-through call like `.andThen((v) => step(ctx, v))`, without inline branching or chaining, in service Result chains.",
			curriedFactory:
				"Prefer a full-arg named step and `.andThen((v) => step(ctx, v))` instead of a curried factory call like `step(ctx)` in service Result chains."
		}
	},
	create(context) {
		if (!isConvexServiceFile(context.filename)) {
			return {};
		}

		const locals = collectLocalFunctions(context.sourceCode.ast);

		function reportInlineDecision(node: ESTree.ConditionalExpression | ESTree.LogicalExpression) {
			const ancestors: ESTree.Node[] = [];
			for (let ancestor: ESTree.Node | null = node.parent; ancestor; ancestor = ancestor.parent) {
				ancestors.unshift(ancestor);
			}
			const chain = ancestors.findLast(
				(ancestor) => ancestor.type === "CallExpression" && isResultChainCall(ancestor)
			);
			if (chain?.type !== "CallExpression") return;

			const callback = chain.arguments[0];
			if (callback?.type !== "ArrowFunctionExpression" || !ancestors.includes(callback)) return;

			// Other callback shapes already receive the general diagnostic.
			if (!isPassThroughNamedCall(callback)) return;

			context.report({ node, messageId: "inlineCallback" });
		}

		return {
			ConditionalExpression: reportInlineDecision,
			LogicalExpression: reportInlineDecision,
			CallExpression(node: ESTree.CallExpression) {
				if (!isResultChainCall(node)) {
					return;
				}

				const firstArg = node.arguments[0];
				if (firstArg === undefined) {
					return;
				}

				if (firstArg.type === "ArrowFunctionExpression" && isPassThroughNamedCall(firstArg)) {
					return;
				}

				if (firstArg.type === "Identifier") {
					return;
				}

				if (firstArg.type === "CallExpression" && isCurriedFactoryCall(firstArg, locals)) {
					context.report({ node: firstArg, messageId: "curriedFactory" });

					return;
				}

				context.report({ node: firstArg, messageId: "inlineCallback" });
			}
		};
	}
});
