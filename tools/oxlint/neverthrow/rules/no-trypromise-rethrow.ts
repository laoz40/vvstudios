import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { unwrapExpression } from "../shared/unwrap-expression.ts";

const TRYPROMISE_NAMES = new Set(["tryPromise"]);

function isTryPromiseCall(node: ESTree.CallExpression): boolean {
	const callee = unwrapExpression(node.callee);

	if (callee.type === "Identifier") {
		return TRYPROMISE_NAMES.has(callee.name);
	}

	return false;
}

function getOptionsObject(node: ESTree.CallExpression): ESTree.ObjectExpression | null {
	const [firstArgument] = node.arguments;

	if (firstArgument === undefined || firstArgument.type === "SpreadElement") {
		return null;
	}

	const unwrapped = unwrapExpression(firstArgument);

	return unwrapped.type === "ObjectExpression" ? unwrapped : null;
}

function getCatchCallback(
	options: ESTree.ObjectExpression
): ESTree.ArrowFunctionExpression | null {
	for (const property of options.properties) {
		if (property.type !== "Property" || property.key.type !== "Identifier") {
			continue;
		}

		if (property.key.name !== "catch") {
			continue;
		}

		const value = unwrapExpression(property.value);

		if (value.type === "ArrowFunctionExpression") {
			return value;
		}
	}

	return null;
}

function callbackParameterName(callback: ESTree.ArrowFunctionExpression): string | null {
	const [parameter] = callback.params;

	if (parameter?.type !== "Identifier") {
		return null;
	}

	return parameter.name;
}

function throwRethrowsParameter(
	statement: ESTree.Statement,
	parameterName: string
): boolean {
	if (statement.type !== "ThrowStatement" || statement.argument === null) {
		return false;
	}

	const thrown = unwrapExpression(statement.argument);

	return thrown.type === "Identifier" && thrown.name === parameterName;
}

function catchCallbackRethrows(callback: ESTree.ArrowFunctionExpression): boolean {
	const parameterName = callbackParameterName(callback);

	if (parameterName === null) {
		return false;
	}

	if (callback.body.type !== "BlockStatement") {
		return false;
	}

	for (const statement of callback.body.body) {
		if (throwRethrowsParameter(statement, parameterName)) {
			return true;
		}
	}

	return false;
}

/**
 * Disallow `tryPromise({ catch: ... throw cause })`. Expected failures belong in the returned domain error;
 * unexpected failures should escape from `try`, not be rethrown from `catch`.
 */
export const noTryPromiseRethrowRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow rethrowing from tryPromise catch handlers. Map expected failures to a domain err; let infra rejections escape from try."
		},
		messages: {
			rethrow:
				"`tryPromise` catch must return a domain error, not rethrow the caught value. Rethrowing defeats the helper and duplicates plain try/catch."
		}
	},
	createOnce(context) {
		return {
			CallExpression(node) {
				if (!isTryPromiseCall(node)) {
					return;
				}

				const options = getOptionsObject(node);

				if (options === null) {
					return;
				}

				const catchCallback = getCatchCallback(options);

				if (catchCallback === null) {
					return;
				}

				if (!catchCallbackRethrows(catchCallback)) {
					return;
				}

				context.report({ node: catchCallback, messageId: "rethrow" });
			}
		};
	}
});
