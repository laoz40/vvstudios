import { defineRule } from "@oxlint/plugins";
import type { ESTree, Scope } from "@oxlint/plugins";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;
type PropertyNode = Extract<ESTree.Node, { type: "Property" }>;
type IdentifierNode = Extract<ESTree.Node, { type: "Identifier" }>;

type FailureReturn = {
	node: ESTree.ReturnStatement;
	identifier: string | null;
	reason: ESTree.Node | null;
};

type LogCall = {
	node: ESTree.CallExpression;
	argument: ESTree.Node | null;
};

const LOGGER_MODULE = "#convex/shared/lib/logger";
type ScopeContext = { sourceCode: { getScope(node: ESTree.Node): Scope | null } };

function propertyName(node: PropertyNode): string | null {
	if (!node.computed && node.key.type === "Identifier") return node.key.name;
	if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value;
	return null;
}

function unwrap(node: ESTree.Node): ESTree.Node {
	while (
		node.type === "TSAsExpression" ||
		node.type === "TSSatisfiesExpression" ||
		node.type === "TSNonNullExpression"
	) {
		node = node.expression;
	}
	return node;
}

function findBinding(node: IdentifierNode, context: ScopeContext): ESTree.Node | null {
	for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
		const variable = scope.set.get(node.name);
		if (variable) return variable.defs[0]?.node ?? null;
	}
	return null;
}

function resolveImport(
	node: ESTree.Node,
	context: ScopeContext,
	seen = new Set<string>()
): ESTree.Node {
	node = unwrap(node);
	if (node.type !== "Identifier" || seen.has(node.name)) return node;
	seen.add(node.name);
	const definition = findBinding(node, context);
	if (definition?.type === "ImportSpecifier" || definition?.type === "ImportNamespaceSpecifier")
		return definition;
	if (
		definition?.type === "VariableDeclarator" &&
		definition.parent?.type === "VariableDeclaration" &&
		definition.parent.kind === "const" &&
		definition.init
	)
		return resolveImport(definition.init, context, seen);
	return node;
}

function isLoggerImport(node: ESTree.Node): boolean {
	return (
		(node.type === "ImportSpecifier" || node.type === "ImportNamespaceSpecifier") &&
		node.parent?.type === "ImportDeclaration" &&
		node.parent.source.value === LOGGER_MODULE
	);
}

function isLogErrorCall(
	node: ESTree.CallExpression,
	context: ScopeContext
): boolean {
	const callee = unwrap(node.callee);
	if (callee.type === "Identifier") {
		const imported = resolveImport(callee, context);
		return (
			imported.type === "ImportSpecifier" &&
			isLoggerImport(imported) &&
			imported.imported.type === "Identifier" &&
			imported.imported.name === "logError"
		);
	}
	if (callee.type !== "MemberExpression") return false;
	const member =
		!callee.computed && callee.property.type === "Identifier"
			? callee.property.name
			: callee.computed && callee.property.type === "Literal"
				? callee.property.value
				: null;
	const object = resolveImport(callee.object, context);
	return member === "logError" && object.type === "ImportNamespaceSpecifier" && isLoggerImport(object);
}

function resolveConst(node: ESTree.Node, context: ScopeContext, seen = new Set<string>()): ESTree.Node {
	node = unwrap(node);
	if (node.type !== "Identifier" || seen.has(node.name)) return node;
	seen.add(node.name);
	const definition = findBinding(node, context);
	if (
		definition?.type === "VariableDeclarator" &&
		definition.parent?.type === "VariableDeclaration" &&
		definition.parent.kind === "const" &&
		definition.init
	)
		return resolveConst(definition.init, context, seen);
	return node;
}

function reasonProperty(node: ESTree.Node): ESTree.Node | null {
	node = unwrap(node);
	if (node.type !== "ObjectExpression") return null;
	for (const property of node.properties) {
		if (property.type === "Property" && property.kind === "init" && propertyName(property) === "reason")
			return property.value;
	}
	return null;
}

function isNeverthrowErrorCall(node: ESTree.CallExpression, context: ScopeContext): boolean {
	const callee = unwrap(node.callee);
	if (callee.type === "Identifier") {
		const imported = resolveImport(callee, context);
		return (
			imported.type === "ImportSpecifier" &&
			imported.parent?.type === "ImportDeclaration" &&
			imported.parent.source.value === "neverthrow" &&
			imported.imported.type === "Identifier" &&
			(imported.imported.name === "err" || imported.imported.name === "errAsync")
		);
	}
	if (callee.type !== "MemberExpression") return false;
	const name =
		!callee.computed && callee.property.type === "Identifier"
			? callee.property.name
			: callee.computed && callee.property.type === "Literal"
				? callee.property.value
				: null;
	const namespace = resolveImport(callee.object, context);
	return (
		(name === "err" || name === "errAsync") &&
		namespace.type === "ImportNamespaceSpecifier" &&
		namespace.parent?.type === "ImportDeclaration" &&
		namespace.parent.source.value === "neverthrow"
	);
}

function returnedFailure(
	node: ESTree.ReturnStatement,
	context: ScopeContext
): FailureReturn | null {
	if (!node.argument) return null;
	let value = unwrap(node.argument);
	let identifier: string | null = null;
	if (value.type === "CallExpression" && isNeverthrowErrorCall(value, context) && value.arguments.length === 1) {
		const arg = value.arguments[0];
		if (!arg || arg.type === "SpreadElement") return null;
		value = unwrap(arg);
		if (value.type === "Identifier") identifier = value.name;
		else if (value.type !== "ObjectExpression" || !reasonProperty(value)) return null;
	} else if (value.type === "Identifier") {
		identifier = value.name;
	}
	const resolved = resolveConst(value, context);
	const reason = reasonProperty(resolved);
	if (!reason && !identifier) return null;
	return { node, identifier, reason };
}

function sameReturnedFailure(log: ESTree.Node | null, failure: FailureReturn): boolean {
	if (!log || !failure.identifier) return false;
	log = unwrap(log);
	if (log.type === "Identifier" && log.name === failure.identifier) return true;
	if (log.type === "MemberExpression") {
		const prop =
			!log.computed && log.property.type === "Identifier"
				? log.property.name
				: log.computed && log.property.type === "Literal"
					? log.property.value
					: null;
		const object = unwrap(log.object);
		return prop === "reason" && object.type === "Identifier" && object.name === failure.identifier;
	}
	return false;
}

function logsFailure(argument: ESTree.Node | null, failure: FailureReturn): boolean {
	if (!argument || !failure.identifier) return false;
	const object = unwrap(argument);
	if (object.type !== "ObjectExpression") return false;
	let reasonIsFromFailure = false;
	for (const property of object.properties) {
		if (property.type === "SpreadElement") {
			reasonIsFromFailure = sameReturnedFailure(property.argument, failure);
			continue;
		}
		if (property.type === "Property" && property.kind === "init" && propertyName(property) === "reason") {
			reasonIsFromFailure = sameReturnedFailure(property.value, failure);
		}
	}
	return reasonIsFromFailure;
}

export const loggedFailureSharesReasonRule = defineRule({
	meta: {
		type: "problem",
		docs: { description: "Require logged failure reasons to come from the returned failure object." },
		messages: {
			failureReason:
				"Log the returned failure object or use its reason (for example, ...failure or reason: failure.reason) so logging and returned errors cannot drift."
		}
	},
	create(context) {
		if (!/(?:^|[\\/])(?:convex|src)(?:[\\/]|$)/u.test(context.filename.replaceAll("\\", "/")))
			return {};

		type Frame = { node: FunctionNode; calls: LogCall[]; returns: FailureReturn[] };
		const frames: Frame[] = [];
		function enter(node: FunctionNode) {
			frames.push({ node, calls: [], returns: [] });
		}
		function exit(node: FunctionNode) {
			const frame = frames.pop();
			if (!frame || frame.node !== node) return;
			for (const call of frame.calls) {
				const failure = frame.returns
					.filter((candidate) => candidate.node.range[0] > call.node.range[0])
					.sort((left, right) => left.node.range[0] - right.node.range[0])[0];
				if (!failure || logsFailure(call.argument, failure)) continue;
				context.report({ node: call.node, messageId: "failureReason" });
			}
		}

		return {
			FunctionDeclaration: enter,
			"FunctionDeclaration:exit": exit,
			FunctionExpression: enter,
			"FunctionExpression:exit": exit,
			ArrowFunctionExpression: enter,
			"ArrowFunctionExpression:exit": exit,
			CallExpression(node: ESTree.CallExpression) {
				if (!frames.length || !isLogErrorCall(node, context)) return;
				const argument = node.arguments[0];
				frames.at(-1)?.calls.push({
					node,
					argument: argument?.type === "SpreadElement" ? null : argument ?? null
				});
			},
			ReturnStatement(node: ESTree.ReturnStatement) {
				const frame = frames.at(-1);
				if (!frame) return;
				const failure = returnedFailure(node, context);
				if (failure) frame.returns.push(failure);
			}
		};
	}
});
