import type { ESTree } from "@oxlint/plugins";

const LOADER_NAME = /^(?:get|load|list)[A-Z]/u;

const ESTREE_CHILD_KEYS: Record<string, string[]> = {
	ArrayExpression: ["elements"],
	ArrowFunctionExpression: ["params", "body"],
	AssignmentExpression: ["left", "right"],
	AssignmentPattern: ["left", "right"],
	AwaitExpression: ["argument"],
	BinaryExpression: ["left", "right"],
	BlockStatement: ["body"],
	CallExpression: ["callee", "arguments"],
	ChainExpression: ["expression"],
	ConditionalExpression: ["test", "consequent", "alternate"],
	ExpressionStatement: ["expression"],
	FunctionDeclaration: ["id", "params", "body"],
	FunctionExpression: ["id", "params", "body"],
	Identifier: [],
	IfStatement: ["test", "consequent", "alternate"],
	LogicalExpression: ["left", "right"],
	MemberExpression: ["object", "property"],
	NewExpression: ["callee", "arguments"],
	ObjectExpression: ["properties"],
	Property: ["key", "value"],
	ReturnStatement: ["argument"],
	SequenceExpression: ["expressions"],
	SpreadElement: ["argument"],
	TemplateLiteral: ["expressions", "quasis"],
	UnaryExpression: ["argument"],
	VariableDeclaration: ["declarations"],
	VariableDeclarator: ["id", "init"]
};

export function isLoaderCalleeName(name: string): boolean {
	return LOADER_NAME.test(name);
}

function isRunQueryOrMutation(node: ESTree.CallExpression): boolean {
	if (node.callee.type !== "MemberExpression" || node.callee.computed) {
		return false;
	}

	if (node.callee.object.type !== "Identifier" || node.callee.object.name !== "ctx") {
		return false;
	}

	if (node.callee.property.type !== "Identifier") {
		return false;
	}

	return node.callee.property.name === "runQuery" || node.callee.property.name === "runMutation";
}

function isCtxDbRead(node: ESTree.CallExpression): boolean {
	if (node.callee.type !== "MemberExpression" || node.callee.computed) {
		return false;
	}

	if (
		node.callee.object.type !== "MemberExpression" ||
		node.callee.object.computed ||
		node.callee.object.object.type !== "Identifier" ||
		node.callee.object.object.name !== "ctx" ||
		node.callee.object.property.type !== "Identifier" ||
		node.callee.object.property.name !== "db"
	) {
		return false;
	}

	if (node.callee.property.type !== "Identifier") {
		return false;
	}

	return node.callee.property.name === "get" || node.callee.property.name === "query";
}

function walkEstree(node: ESTree.Node | null | undefined, visit: (node: ESTree.Node) => void) {
	if (node === null || node === undefined) {
		return;
	}

	visit(node);

	const childKeys = ESTREE_CHILD_KEYS[node.type];

	if (childKeys === undefined) {
		return;
	}

	for (const key of childKeys) {
		const value = (node as unknown as Record<string, unknown>)[key];

		if (Array.isArray(value)) {
			for (const child of value) {
				if (child !== null && typeof child === "object" && "type" in child) {
					walkEstree(child as ESTree.Node, visit);
				}
			}

			continue;
		}

		if (value !== null && typeof value === "object" && "type" in value) {
			walkEstree(value as ESTree.Node, visit);
		}
	}
}

function expressionContainsDbRead(node: ESTree.Node): boolean {
	let found = false;

	walkEstree(node, (child) => {
		if (found || child.type !== "CallExpression") {
			return;
		}

		if (isCtxDbRead(child) || isRunQueryOrMutation(child)) {
			found = true;
		}
	});

	return found;
}

export function isLoaderCallExpression(node: ESTree.CallExpression): boolean {
	if (node.callee.type === "Identifier") {
		if (node.callee.name === "okOrThrow" && node.arguments[0] !== undefined) {
			return expressionContainsDbRead(node.arguments[0]);
		}

		return isLoaderCalleeName(node.callee.name);
	}

	return false;
}

function isAndThenMember(node: ESTree.MemberExpression): boolean {
	if (node.computed || node.property.type !== "Identifier") {
		return false;
	}

	return node.property.name === "andThen" || node.property.name === "asyncAndThen";
}

function chainRootExpression(node: ESTree.Expression): ESTree.Expression {
	if (node.type === "MemberExpression" && isAndThenMember(node)) {
		return chainRootExpression(node.object);
	}

	if (node.type === "CallExpression") {
		return node;
	}

	return node;
}

export function isLoaderAndThenChain(node: ESTree.Expression): boolean {
	if (node.type !== "MemberExpression" || !isAndThenMember(node)) {
		return false;
	}

	const root = chainRootExpression(node.object);

	return root.type === "CallExpression" && isLoaderCallExpression(root);
}

export function collectLoaderAndThenNodes(body: ESTree.BlockStatement | ESTree.Expression): ESTree.MemberExpression[] {
	const matches: ESTree.MemberExpression[] = [];

	walkEstree(body, (node) => {
		if (node.type === "MemberExpression" && isAndThenMember(node) && isLoaderAndThenChain(node)) {
			matches.push(node);
		}
	});

	return matches;
}
