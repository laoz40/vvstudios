import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

type MapErrCallback = ESTree.ArrowFunctionExpression;

function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;

	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSTypeAssertion" ||
		current.type === "TSNonNullExpression"
	) {
		current = current.expression;
	}

	return current;
}

function isMapErrCall(node: ESTree.CallExpression): boolean {
	const callee = unwrapExpression(node.callee);

	return (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.property.type === "Identifier" &&
		callee.property.name === "mapErr"
	);
}

function isAndThenCall(node: ESTree.CallExpression): boolean {
	const callee = unwrapExpression(node.callee);

	return (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.property.type === "Identifier" &&
		callee.property.name === "andThen"
	);
}

function toMapErrCallback(node: ESTree.Expression): MapErrCallback | null {
	const unwrapped = unwrapExpression(node);

	if (unwrapped.type === "ArrowFunctionExpression") {
		return unwrapped;
	}

	return null;
}

function functionBody(callback: MapErrCallback): ESTree.BlockStatement | null {
	if (callback.body.type === "BlockStatement") {
		return callback.body;
	}

	return null;
}

function callbackParameterName(callback: MapErrCallback): string | null {
	const [parameter] = callback.params;

	if (parameter?.type !== "Identifier") {
		return null;
	}

	return parameter.name;
}

function returnsParameter(statement: ESTree.Statement, parameterName: string): boolean {
	if (statement.type !== "ReturnStatement" || statement.argument === null) {
		return false;
	}

	const argument = unwrapExpression(statement.argument);

	return argument.type === "Identifier" && argument.name === parameterName;
}

function isIdentityCallback(callback: MapErrCallback): boolean {
	const parameterName = callbackParameterName(callback);

	if (parameterName === null) {
		return false;
	}

	if (callback.body.type !== "BlockStatement") {
		const body = unwrapExpression(callback.body);

		return body.type === "Identifier" && body.name === parameterName;
	}

	if (callback.body.body.length !== 1) {
		return false;
	}

	const [statement] = callback.body.body;

	if (statement === undefined) {
		return false;
	}

	return returnsParameter(statement, parameterName);
}

function isErrorReasonDiscriminant(
	discriminant: ESTree.Expression,
	parameterName: string
): boolean {
	const unwrapped = unwrapExpression(discriminant);

	return (
		unwrapped.type === "MemberExpression" &&
		!unwrapped.computed &&
		unwrapped.object.type === "Identifier" &&
		unwrapped.object.name === parameterName &&
		unwrapped.property.type === "Identifier" &&
		unwrapped.property.name === "reason"
	);
}

function switchHasPassthroughAndDefault(
	switchStatement: ESTree.SwitchStatement,
	parameterName: string
): boolean {
	if (!isErrorReasonDiscriminant(switchStatement.discriminant, parameterName)) {
		return false;
	}

	let hasPassthrough = false;
	let hasDefault = false;

	for (const switchCase of switchStatement.cases) {
		if (switchCase.test === null) {
			hasDefault = true;
			continue;
		}

		for (const consequent of switchCase.consequent) {
			if (returnsParameter(consequent, parameterName)) {
				hasPassthrough = true;
			}
		}
	}

	return hasPassthrough && hasDefault;
}

function findRemapSwitch(
	body: ESTree.BlockStatement,
	parameterName: string
): ESTree.SwitchStatement | null {
	for (const statement of body.body) {
		if (statement.type !== "SwitchStatement") {
			continue;
		}

		if (switchHasPassthroughAndDefault(statement, parameterName)) {
			return statement;
		}
	}

	return null;
}

function getMapErrCallback(node: ESTree.CallExpression): MapErrCallback | null {
	const [callbackExpression] = node.arguments;

	if (callbackExpression === undefined || callbackExpression.type === "SpreadElement") {
		return null;
	}

	return toMapErrCallback(callbackExpression);
}

function getAndThenReceiver(node: ESTree.CallExpression): ESTree.CallExpression | null {
	const callee = unwrapExpression(node.callee);

	if (callee.type !== "MemberExpression" || callee.object.type !== "CallExpression") {
		return null;
	}

	const receiver = callee.object;

	return isAndThenCall(receiver) ? receiver : null;
}

const CHAIN_COMBINATORS = new Set(["andThen", "orElse", "map", "asyncAndThen", "andThrough", "orTee"]);

function callPropertyName(node: ESTree.CallExpression): string | null {
	const callee = unwrapExpression(node.callee);

	if (callee.type === "Identifier") {
		return callee.name;
	}

	if (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "Identifier" &&
		callee.object.name === "ResultAsync" &&
		callee.property.type === "Identifier" &&
		callee.property.name === "fromPromise"
	) {
		return "fromPromise";
	}

	return null;
}

function isChainCombinatorCall(node: ESTree.CallExpression): boolean {
	const callee = unwrapExpression(node.callee);

	if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") {
		return false;
	}

	return CHAIN_COMBINATORS.has(callee.property.name);
}

function getMapErrReceiverCall(node: ESTree.CallExpression): ESTree.CallExpression | null {
	const callee = unwrapExpression(node.callee);

	if (callee.type !== "MemberExpression" || callee.object.type !== "CallExpression") {
		return null;
	}

	const receiver = callee.object;

	if (isChainCombinatorCall(receiver)) {
		return null;
	}

	return receiver;
}

function expressionReferencesIdentifier(expression: ESTree.Expression, identifierName: string): boolean {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case "Identifier":
			return unwrapped.name === identifierName;
		case "MemberExpression":
			return expressionReferencesIdentifier(unwrapped.object, identifierName);
		case "ObjectExpression":
			return unwrapped.properties.some((property) => {
				if (property.type === "SpreadElement") {
					return expressionReferencesIdentifier(property.argument, identifierName);
				}

				if (property.type !== "Property") {
					return false;
				}

				return expressionReferencesIdentifier(property.value, identifierName);
			});
		case "ArrayExpression":
			return unwrapped.elements.some(
				(element) =>
					element !== null &&
					(element.type === "SpreadElement"
						? expressionReferencesIdentifier(element.argument, identifierName)
						: expressionReferencesIdentifier(element, identifierName))
			);
		case "CallExpression":
			return (
				expressionReferencesIdentifier(unwrapped.callee, identifierName) ||
				unwrapped.arguments.some((argument) =>
					argument.type === "SpreadElement"
						? expressionReferencesIdentifier(argument.argument, identifierName)
						: expressionReferencesIdentifier(argument, identifierName)
				)
			);
		case "ConditionalExpression":
			return (
				expressionReferencesIdentifier(unwrapped.test, identifierName) ||
				expressionReferencesIdentifier(unwrapped.consequent, identifierName) ||
				expressionReferencesIdentifier(unwrapped.alternate, identifierName)
			);
		case "UnaryExpression":
		case "AwaitExpression":
			return expressionReferencesIdentifier(unwrapped.argument, identifierName);
		case "BinaryExpression":
		case "LogicalExpression":
			return (
				expressionReferencesIdentifier(unwrapped.left, identifierName) ||
				expressionReferencesIdentifier(unwrapped.right, identifierName)
			);
		case "SequenceExpression":
			return unwrapped.expressions.some((expression) =>
				expressionReferencesIdentifier(expression, identifierName)
			);
		case "TemplateLiteral":
			return unwrapped.expressions.some((expression) =>
				expressionReferencesIdentifier(expression, identifierName)
			);
		default:
			return false;
	}
}

function getReturnExpressions(callback: MapErrCallback): ESTree.Expression[] {
	if (callback.body.type !== "BlockStatement") {
		return [callback.body];
	}

	const returns: ESTree.Expression[] = [];

	for (const statement of callback.body.body) {
		if (statement.type === "ReturnStatement" && statement.argument !== null) {
			returns.push(statement.argument);
		}
	}

	return returns;
}

function isInlineErrorObject(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type !== "ObjectExpression") {
		return false;
	}

	return unwrapped.properties.some((property) => {
		if (property.type !== "Property" || property.key.type !== "Identifier") {
			return false;
		}

		return property.key.name === "reason" || property.key.name === "kind";
	});
}

function isCollapseMapErrCallback(callback: MapErrCallback): boolean {
	const parameterName = callbackParameterName(callback);
	const returnExpressions = getReturnExpressions(callback);

	if (returnExpressions.length === 0) {
		return false;
	}

	return returnExpressions.every((returnExpression) => {
		if (!isInlineErrorObject(returnExpression)) {
			return false;
		}

		if (parameterName === null) {
			return true;
		}

		return !expressionReferencesIdentifier(returnExpression, parameterName);
	});
}

function isRedundantResultCallMapErr(node: ESTree.CallExpression, callback: MapErrCallback): boolean {
	const receiverCall = getMapErrReceiverCall(node);

	if (receiverCall === null) {
		return false;
	}

	const rootName = callPropertyName(receiverCall);

	if (rootName === null) {
		return false;
	}

	return isCollapseMapErrCallback(callback);
}

/** Reject redundant mapErr in service chains; errors propagate to `.match(tupleOk, tupleErr)`. */
export const noServiceErrorRemapSwitchRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow redundant mapErr in service chains: identity passthrough, passthrough switches, collapse on result-returning calls, and identity andThen unwraps."
		},
		messages: {
			identityMapErr:
				"`mapErr` that returns the error unchanged is a no-op. Errors already propagate through the chain to the handler `.match(tupleOk, tupleErr)`.",
			identityAndThenMapErr:
				"`.andThen((value) => value).mapErr((error) => error)` does nothing. Remove both calls and let errors propagate.",
			remapSwitch:
				"Errors propagate through the chain to the handler `.match(tupleOk, tupleErr)`. Group related reasons on the client with a switch instead of remapping here.",
			collapseOnResultCall:
				"This call already returns a `Result`. Remove `mapErr` and let the specific error reach the client. Group related reasons in the caller switch when the UX is the same."
		}
	},
	createOnce(context) {
		return {
			CallExpression(node) {
				if (!isMapErrCall(node)) {
					return;
				}

				const callback = getMapErrCallback(node);

				if (callback === null) {
					return;
				}

				if (isIdentityCallback(callback)) {
					const andThenReceiver = getAndThenReceiver(node);

					context.report({
						node,
						messageId: andThenReceiver === null ? "identityMapErr" : "identityAndThenMapErr"
					});

					return;
				}

				if (isRedundantResultCallMapErr(node, callback)) {
					context.report({ node, messageId: "collapseOnResultCall" });

					return;
				}

				const parameterName = callbackParameterName(callback);

				if (parameterName === null) {
					return;
				}

				const body = functionBody(callback);

				if (body === null) {
					return;
				}

				const remapSwitch = findRemapSwitch(body, parameterName);

				if (remapSwitch === null) {
					return;
				}

				context.report({ node: remapSwitch, messageId: "remapSwitch" });
			}
		};
	}
});
