import { defineRule } from "@oxlint/plugins";
import type { ESTree, Scope } from "@oxlint/plugins";

import { isConvexLibFile, isConvexServiceFile } from "../shared/paths.ts";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

const RESULT_CONSTRUCTORS = new Set(["ok", "err", "okAsync", "errAsync"]);
// Keep this rule focused on tiny pass-through shapes. In particular, a builder with three or more
// fields may be a useful payload builder and is left to human judgment.
const MAX_STATIC_OBJECT_PROPERTIES = 2;

function parameterNames(params: ESTree.Node[]): Set<string> {
	return new Set(params.flatMap((param) => (param.type === "Identifier" ? [param.name] : [])));
}

function isStaticOrIdentity(
	node: ESTree.Node,
	params: Set<string>,
	resolve: (node: ESTree.Node) => ESTree.Node
): boolean {
	node = resolve(node);
	if (node.type === "Literal") return true;
	if (node.type === "Identifier") return params.has(node.name);

	if (node.type === "ObjectExpression") {
		if (node.properties.length > MAX_STATIC_OBJECT_PROPERTIES) return false;
		return node.properties.every(
			(property) =>
				property.type === "Property" &&
				property.kind === "init" &&
				!property.computed &&
				isStaticOrIdentity(property.value, params, resolve)
		);
	}

	if (
		node.type === "CallExpression" &&
		isResultConstructor(resolve(node.callee), resolve) &&
		node.arguments.length === 1
	) {
		const [argument] = node.arguments;
		return (
			argument !== undefined &&
			argument.type !== "SpreadElement" &&
			isStaticOrIdentity(argument, params, resolve)
		);
	}

	return false;
}

function isResultConstructor(
	node: ESTree.Node,
	resolve: (node: ESTree.Node) => ESTree.Node
): boolean {
	if (
		node.type === "ImportSpecifier" &&
		node.parent?.type === "ImportDeclaration" &&
		node.parent.source.value === "neverthrow"
	) {
		const name = node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
		return RESULT_CONSTRUCTORS.has(name);
	}
	if (node.type !== "MemberExpression") return false;
	const namespace = resolve(node.object);
	if (
		namespace.type !== "ImportNamespaceSpecifier" ||
		namespace.parent?.type !== "ImportDeclaration" ||
		namespace.parent.source.value !== "neverthrow"
	)
		return false;
	const name =
		!node.computed && node.property.type === "Identifier"
			? node.property.name
			: node.property.type === "Literal" && typeof node.property.value === "string"
				? node.property.value
				: null;
	return name !== null && RESULT_CONSTRUCTORS.has(name);
}

function unwrapTypeScriptExpression(node: ESTree.Node): ESTree.Node {
	while (
		(node.type === "TSAsExpression" ||
			node.type === "TSSatisfiesExpression" ||
			node.type === "TSNonNullExpression") &&
		"expression" in node
	) {
		node = node.expression;
	}
	return node;
}

function returnedExpression(
	fn: FunctionNode,
	resolve: (node: ESTree.Node) => ESTree.Node
): ESTree.Node | null {
	if (fn.body === null) return null;
	if (fn.body.type !== "BlockStatement") return fn.body;
	const params = parameterNames(fn.params);
	const declarations = fn.body.body.slice(0, -1);
	if (
		!declarations.every(
			(statement) =>
				statement.type === "VariableDeclaration" &&
				statement.kind === "const" &&
				statement.declarations.every(
					(declaration) =>
						declaration.id.type === "Identifier" &&
						declaration.init !== null &&
						isStaticOrIdentity(declaration.init, params, resolve)
				)
		)
	)
		return null;
	const statement = fn.body.body.at(-1);
	return statement?.type === "ReturnStatement" ? statement.argument : null;
}

function isNamedHelper(node: ESTree.Node): node is FunctionNode {
	if (node.type === "FunctionDeclaration") {
		return node.id !== null;
	}

	if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") return false;
	const declarator = node.parent;
	return (
		declarator.type === "VariableDeclarator" &&
		declarator.id.type === "Identifier" &&
		declarator.parent.type === "VariableDeclaration" &&
		declarator.parent.kind === "const"
	);
}

/**
 * Flags only named helpers in Convex services/libs whose whole body is a static value,
 * a parameter pass-through, a tiny static object (at most two properties), or a Result constructor
 * around one of those. It deliberately does not inspect conditional/control-flow functions or
 * larger payload builders.
 */
export const noTrivialResultWrapperRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow trivial named helpers in Convex services and libs that only return a literal, pass through an argument, or wrap either in a Result."
		},
		messages: {
			trivialWrapper:
				"Remove this trivial helper and use its value, argument, or Result constructor at the call site."
		}
	},
	create(context) {
		if (!isConvexLibFile(context.filename) && !isConvexServiceFile(context.filename)) return {};
		const filename = context.filename.replaceAll("\\", "/");
		if (/\/(?:__tests__|tests?)\/|\.(?:test|spec)\.tsx?$/u.test(filename)) return {};

		function resolve(node: ESTree.Node, seen = new Set<ESTree.Node>()): ESTree.Node {
			node = unwrapTypeScriptExpression(node);
			if (seen.has(node)) return node;
			seen.add(node);
			if (node.type !== "Identifier") return node;
			for (
				let scope: Scope | null = context.sourceCode.getScope(node);
				scope;
				scope = scope.upper
			) {
				const variable = scope.set.get(node.name);
				if (!variable) continue;
				for (const definition of variable.defs) {
					const declaration = definition.node;
					if (
						declaration.type === "VariableDeclarator" &&
						declaration.init &&
						declaration.parent?.type === "VariableDeclaration" &&
						declaration.parent.kind === "const"
					)
						return resolve(declaration.init, seen);
					if (
						declaration.type === "ImportSpecifier" ||
						declaration.type === "ImportNamespaceSpecifier"
					)
						return declaration;
				}
				break;
			}
			return node;
		}
		return {
			FunctionDeclaration(node: ESTree.Function) {
				if (!isNamedHelper(node)) return;
				const returned = returnedExpression(node, resolve);
				if (
					returned !== null &&
					isStaticOrIdentity(returned, parameterNames(node.params), resolve)
				) {
					context.report({ node, messageId: "trivialWrapper" });
				}
			},
			ArrowFunctionExpression(node: ESTree.ArrowFunctionExpression) {
				if (!isNamedHelper(node)) return;
				const returned = returnedExpression(node, resolve);
				if (
					returned !== null &&
					isStaticOrIdentity(returned, parameterNames(node.params), resolve)
				) {
					context.report({ node, messageId: "trivialWrapper" });
				}
			},
			FunctionExpression(node: ESTree.Function) {
				if (!isNamedHelper(node)) return;
				const returned = returnedExpression(node, resolve);
				if (
					returned !== null &&
					isStaticOrIdentity(returned, parameterNames(node.params), resolve)
				) {
					context.report({ node, messageId: "trivialWrapper" });
				}
			}
		};
	}
});
