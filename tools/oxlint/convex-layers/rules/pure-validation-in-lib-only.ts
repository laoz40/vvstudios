import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { isConvexServiceFile } from "../shared/paths.ts";

const CHAIN_METHOD_NAMES = new Set(["andThen", "asyncAndThen"]);

type IdentifierNode = ESTree.Node & { type: "Identifier"; name: string };

type FunctionDeclarationNode = ESTree.Node & {
	type: "FunctionDeclaration";
	id: IdentifierNode | null;
	params: ESTree.Node[];
	body: ESTree.BlockStatement;
};

type FunctionLikeNode = ESTree.ArrowFunctionExpression | ESTree.Function | FunctionDeclarationNode;

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

function isLibOrServiceImport(source: string): boolean {
	return source.startsWith("#convex/lib/") || source.startsWith("#convex/services/");
}

function collectImportedNames(program: ESTree.Program): Set<string> {
	const imported = new Set<string>();

	for (const statement of program.body) {
		if (statement.type !== "ImportDeclaration") {
			continue;
		}

		if (!isLibOrServiceImport(statement.source.value)) {
			continue;
		}

		for (const specifier of statement.specifiers) {
			if (specifier.type === "ImportSpecifier" && specifier.imported.type === "Identifier") {
				imported.add(specifier.local.name);
			}

			if (specifier.type === "ImportDefaultSpecifier") {
				imported.add(specifier.local.name);
			}
		}
	}

	return imported;
}

function functionFromDeclarator(
	declarator: ESTree.VariableDeclarator
): ESTree.ArrowFunctionExpression | ESTree.Function | null {
	if (declarator.init === null) {
		return null;
	}

	if (declarator.init.type === "ArrowFunctionExpression" || declarator.init.type === "FunctionExpression") {
		return declarator.init;
	}

	return null;
}

function collectLocalFunctions(program: ESTree.Program): Map<string, FunctionLikeNode> {
	const locals = new Map<string, FunctionLikeNode>();

	for (const statement of program.body) {
		if (statement.type === "FunctionDeclaration" && statement.id !== null) {
			locals.set(statement.id.name, statement);
		}

		if (statement.type !== "ExportNamedDeclaration") {
			continue;
		}

		if (statement.declaration?.type === "FunctionDeclaration" && statement.declaration.id !== null) {
			locals.set(statement.declaration.id.name, statement.declaration);
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

function resolveCalleeToLocal(
	node: ESTree.Expression | ESTree.SpreadElement,
	locals: Map<string, FunctionLikeNode>
): FunctionLikeNode | null {
	if (node.type === "SpreadElement") {
		return null;
	}

	if (node.type === "Identifier") {
		return locals.get(node.name) ?? null;
	}

	if (node.type !== "CallExpression") {
		return null;
	}

	if (node.callee.type !== "Identifier") {
		return null;
	}

	return locals.get(node.callee.name) ?? null;
}

function resolvePassThroughLocalCall(
	node: ESTree.ArrowFunctionExpression,
	locals: Map<string, FunctionLikeNode>
): FunctionLikeNode | null {
	if (node.body.type === "BlockStatement") {
		return null;
	}

	const body = node.body;

	if (body.type !== "CallExpression" || body.callee.type !== "Identifier") {
		return null;
	}

	return locals.get(body.callee.name) ?? null;
}

function resolveChainStepToLocal(
	node: ESTree.Expression | ESTree.SpreadElement,
	locals: Map<string, FunctionLikeNode>
): FunctionLikeNode | null {
	const direct = resolveCalleeToLocal(node, locals);

	if (direct !== null) {
		return direct;
	}

	if (node.type === "ArrowFunctionExpression") {
		return resolvePassThroughLocalCall(node, locals);
	}

	return null;
}

function paramsIncludeCtx(params: ESTree.Node[]): boolean {
	return params.some(
		(parameter) => parameter.type === "Identifier" && parameter.name === "ctx"
	);
}

function usesForbiddenIo(node: ESTree.Node, visited = new WeakSet<ESTree.Node>()): boolean {
	if (visited.has(node)) {
		return false;
	}

	visited.add(node);

	if (node.type === "Identifier" && node.name === "ctx") {
		return true;
	}

	if (node.type === "CallExpression") {
		if (node.callee.type === "Identifier" && node.callee.name === "okOrThrow") {
			return true;
		}

		if (node.callee.type === "Identifier" && node.callee.name === "tryPromise") {
			return true;
		}

		if (
			node.callee.type === "MemberExpression" &&
			node.callee.object.type === "Identifier" &&
			node.callee.object.name === "ctx" &&
			node.callee.property.type === "Identifier" &&
			(node.callee.property.name === "db" ||
				node.callee.property.name === "runQuery" ||
				node.callee.property.name === "runMutation")
		) {
			return true;
		}
	}

	for (const key of Object.keys(node) as (keyof ESTree.Node)[]) {
		const child = node[key];

		if (child === null || child === undefined) {
			continue;
		}

		if (Array.isArray(child)) {
			for (const item of child) {
				if (item !== null && typeof item === "object" && "type" in item && usesForbiddenIo(item as ESTree.Node, visited)) {
					return true;
				}
			}

			continue;
		}

		if (typeof child === "object" && "type" in child && usesForbiddenIo(child as ESTree.Node, visited)) {
			return true;
		}
	}

	return false;
}

function isOkErrCall(node: ESTree.Expression): boolean {
	return (
		node.type === "CallExpression" &&
		node.callee.type === "Identifier" &&
		(node.callee.name === "err" || node.callee.name === "ok")
	);
}

function hasReturnOutsideOkErr(body: ESTree.BlockStatement | ESTree.Expression): boolean {
	let found = false;
	const visited = new WeakSet<ESTree.Node>();

	function visit(node: ESTree.Node) {
		if (found || visited.has(node)) {
			return;
		}

		visited.add(node);

		if (node.type === "ReturnStatement" && node.argument !== null && !isOkErrCall(node.argument)) {
			found = true;

			return;
		}

		for (const key of Object.keys(node) as (keyof ESTree.Node)[]) {
			const child = node[key];

			if (child === null || child === undefined || typeof child !== "object") {
				continue;
			}

			if (Array.isArray(child)) {
				for (const item of child) {
					if (item !== null && typeof item === "object" && "type" in item) {
						visit(item as ESTree.Node);
					}
				}

				continue;
			}

			if ("type" in child) {
				visit(child as ESTree.Node);
			}
		}
	}

	visit(body);

	return found;
}

/** Pure validation steps return domain outcomes via ok/err (sync), not I/O. */
function hasOkErrReturns(body: ESTree.BlockStatement | ESTree.Expression): boolean {
	let found = false;
	const visited = new WeakSet<ESTree.Node>();

	function visit(node: ESTree.Node) {
		if (found || visited.has(node)) {
			return;
		}

		visited.add(node);

		if (node.type === "ReturnStatement" && node.argument !== null && isOkErrCall(node.argument)) {
			found = true;

			return;
		}

		for (const key of Object.keys(node) as (keyof ESTree.Node)[]) {
			const child = node[key];

			if (child === null || child === undefined || typeof child !== "object") {
				continue;
			}

			if (Array.isArray(child)) {
				for (const item of child) {
					if (item !== null && typeof item === "object" && "type" in item) {
						visit(item as ESTree.Node);
					}
				}

				continue;
			}

			if ("type" in child) {
				visit(child as ESTree.Node);
			}
		}
	}

	visit(body);

	return found;
}

function unaryValidationFunction(
	fn: FunctionLikeNode
): ESTree.ArrowFunctionExpression | ESTree.Function | null {
	if (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") {
		if (fn.params.length !== 1) {
			return null;
		}

		return fn;
	}

	if (fn.params.length !== 1) {
		return null;
	}

	const declarationBody = fn.body;

	if (declarationBody === null || declarationBody.type !== "BlockStatement") {
		return null;
	}

	for (const statement of declarationBody.body) {
		if (statement.type !== "ReturnStatement" || statement.argument === null) {
			continue;
		}

		const returned = statement.argument;

		if (returned.type === "ArrowFunctionExpression" || returned.type === "FunctionExpression") {
			if (returned.params.length === 1) {
				return returned;
			}
		}
	}

	return null;
}

function validationTarget(fn: FunctionLikeNode): ESTree.ArrowFunctionExpression | ESTree.Function | null {
	const curriedInner = unaryValidationFunction(fn);

	if (curriedInner !== null) {
		return curriedInner;
	}

	if (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") {
		if (fn.params.length === 0 || paramsIncludeCtx(fn.params)) {
			return null;
		}

		return fn;
	}

	if (fn.params.length === 0 || paramsIncludeCtx(fn.params)) {
		return null;
	}

	return fn;
}

function isPureValidationFunction(fn: FunctionLikeNode): boolean {
	const target = validationTarget(fn);

	if (target === null) {
		return false;
	}

	const validationBody = target.body;

	if (validationBody === null) {
		return false;
	}

	if (usesForbiddenIo(validationBody)) {
		return false;
	}

	if (hasReturnOutsideOkErr(validationBody)) {
		return false;
	}

	return hasOkErrReturns(validationBody);
}

function bindingNameForChainArg(node: ESTree.Expression): string | null {
	if (node.type === "Identifier") {
		return node.name;
	}

	if (node.type === "CallExpression" && node.callee.type === "Identifier") {
		return node.callee.name;
	}

	if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
		const body = node.body;

		if (body.type === "CallExpression" && body.callee.type === "Identifier") {
			return body.callee.name;
		}
	}

	return null;
}

/** Pure validation steps in services belong in convex/lib. */
export const pureValidationInLibOnlyRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow local pure validation helpers used in service Result chains; move them to convex/lib."
		},
		messages: {
			pureValidationInService:
				"Pure validation belongs in convex/lib. Move this function to a validate* (or reject*) helper and import it."
		}
	},
	create(context) {
		if (!isConvexServiceFile(context.filename)) {
			return {};
		}

		const sourceCode = context.sourceCode;
		const program = sourceCode.ast;
		const imported = collectImportedNames(program);
		const locals = collectLocalFunctions(program);

		return {
			CallExpression(node: ESTree.CallExpression) {
				if (!isResultChainCall(node)) {
					return;
				}

				const firstArg = node.arguments[0];

				if (firstArg === undefined) {
					return;
				}

				const localFn = resolveChainStepToLocal(firstArg, locals);

				if (localFn === null) {
					return;
				}

				if (firstArg.type === "SpreadElement") {
					return;
				}

				const bindingName = bindingNameForChainArg(firstArg);

				if (bindingName !== null && imported.has(bindingName)) {
					return;
				}

				if (!isPureValidationFunction(localFn)) {
					return;
				}

				context.report({ node: firstArg, messageId: "pureValidationInService" });
			}
		};
	}
});
