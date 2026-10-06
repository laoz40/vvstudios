import type { ESTree } from "@oxlint/plugins";

type FunctionDeclarationNode = ESTree.Node & {
	type: "FunctionDeclaration";
	id: (ESTree.Node & { type: "Identifier"; name: string }) | null;
	body: ESTree.BlockStatement;
};

export type FunctionLikeNode = ESTree.ArrowFunctionExpression | FunctionDeclarationNode;

function functionFromDeclarator(
	declarator: ESTree.VariableDeclarator
): ESTree.ArrowFunctionExpression | null {
	if (declarator.init === null) {
		return null;
	}

	if (declarator.init.type === "ArrowFunctionExpression") {
		return declarator.init;
	}

	return null;
}

export function collectLocalFunctions(program: ESTree.Program): Map<string, FunctionLikeNode> {
	const locals = new Map<string, FunctionLikeNode>();

	for (const statement of program.body) {
		if (statement.type === "FunctionDeclaration" && statement.id !== null) {
			locals.set(statement.id.name, statement as FunctionDeclarationNode);
		}

		if (statement.type !== "ExportNamedDeclaration") {
			continue;
		}

		if (statement.declaration?.type === "FunctionDeclaration" && statement.declaration.id !== null) {
			locals.set(statement.declaration.id.name, statement.declaration as FunctionDeclarationNode);
		}

		if (statement.declaration?.type !== "VariableDeclaration") {
			continue;
		}

		for (const declarator of statement.declaration.declarations) {
			if (declarator.id.type !== "Identifier") {
				continue;
			}

			const fn = functionFromDeclarator(declarator);

			if (fn !== null) {
				locals.set(declarator.id.name, fn);
			}
		}
	}

	return locals;
}

function returnedInnerArrow(
	node: ESTree.BlockStatement | ESTree.Expression
): ESTree.ArrowFunctionExpression | null {
	if (node.type === "ArrowFunctionExpression") {
		const body = node.body;
		if (body.type === "ArrowFunctionExpression") {
			return body;
		}

		return null;
	}

	if (node.type !== "BlockStatement") {
		return null;
	}

	if (node.body.length !== 1) {
		return null;
	}

	const statement = node.body[0];
	if (statement === undefined || statement.type !== "ReturnStatement" || statement.argument === null) {
		return null;
	}

	const argument = statement.argument;

	if (argument.type === "ArrowFunctionExpression") {
		return argument;
	}

	return null;
}

/** Heuristic: factory that closes over outer params and returns a chain step callback. */
export function isCurriedFactoryFunction(fn: FunctionLikeNode): boolean {
	if (fn.type === "FunctionDeclaration") {
		return returnedInnerArrow(fn.body) !== null;
	}

	return returnedInnerArrow(fn) !== null;
}

export function resolveCalleeToLocal(
	node: ESTree.Expression | ESTree.SpreadElement,
	locals: Map<string, FunctionLikeNode>
): FunctionLikeNode | null {
	if (node.type === "SpreadElement") {
		return null;
	}

	if (node.type === "Identifier") {
		return locals.get(node.name) ?? null;
	}

	if (node.type !== "CallExpression" || node.callee.type !== "Identifier") {
		return null;
	}

	return locals.get(node.callee.name) ?? null;
}

export function isPassThroughNamedCall(arg: ESTree.ArrowFunctionExpression): boolean {
	if (arg.body.type === "BlockStatement") {
		return false;
	}

	const body = arg.body;

	return body.type === "CallExpression" && body.callee.type === "Identifier";
}

export function isInlineBlockCallback(node: ESTree.Expression | ESTree.SpreadElement): boolean {
	if (node.type === "SpreadElement") {
		return false;
	}

	if (node.type === "FunctionExpression") {
		return true;
	}

	if (node.type !== "ArrowFunctionExpression") {
		return false;
	}

	return node.body.type === "BlockStatement";
}
