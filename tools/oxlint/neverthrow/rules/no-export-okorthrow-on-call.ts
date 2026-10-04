import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { unwrapExpression } from "../shared/unwrap-expression.ts";

const OK_OR_THROW_NAMES = new Set(["okOrThrow"]);

const ALLOWED_CTX_ROOTS = new Set(["db", "scheduler", "auth"]);

const ALLOWED_CTX_CALLS = new Set(["runQuery", "runMutation"]);

function isOkOrThrowCall(node: ESTree.CallExpression): boolean {
	const callee = unwrapExpression(node.callee);

	if (callee.type === "Identifier") {
		return OK_OR_THROW_NAMES.has(callee.name);
	}

	return false;
}

function stripPromiseChain(expression: ESTree.Expression): ESTree.Expression {
	let current = unwrapExpression(expression);

	for (;;) {
		if (current.type !== "CallExpression") {
			break;
		}

		const callee = unwrapExpression(current.callee);

		if (
			callee.type === "MemberExpression" &&
			!callee.computed &&
			callee.property.type === "Identifier" &&
			callee.property.name === "then"
		) {
			current = unwrapExpression(callee.object);

			continue;
		}

		break;
	}

	return current;
}

function isCtxIdentifier(node: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(node);

	return unwrapped.type === "Identifier" && unwrapped.name === "ctx";
}

function memberPropertyName(member: ESTree.MemberExpression): string | null {
	if (member.computed || member.property.type !== "Identifier") {
		return null;
	}

	return member.property.name;
}

function allowedCtxRootFromMember(member: ESTree.MemberExpression): string | null {
	if (isCtxIdentifier(member.object)) {
		return memberPropertyName(member);
	}

	if (member.object.type === "MemberExpression") {
		return allowedCtxRootFromMember(member.object);
	}

	if (member.object.type === "CallExpression") {
		return allowedCtxRootFromExpression(member.object);
	}

	return null;
}

function allowedCtxRootFromExpression(expression: ESTree.Expression): string | null {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === "MemberExpression") {
		return allowedCtxRootFromMember(unwrapped);
	}

	if (unwrapped.type === "CallExpression") {
		const callee = unwrapExpression(unwrapped.callee);

		if (callee.type === "MemberExpression" && isCtxIdentifier(callee.object)) {
			const methodName = memberPropertyName(callee);

			return methodName !== null && ALLOWED_CTX_CALLS.has(methodName) ? methodName : null;
		}

		if (callee.type === "MemberExpression") {
			return allowedCtxRootFromMember(callee);
		}

		return null;
	}

	return null;
}

function isRateLimiterLimitOnCtx(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type !== "CallExpression") {
		return false;
	}

	const callee = unwrapExpression(unwrapped.callee);

	if (
		callee.type !== "MemberExpression" ||
		callee.computed ||
		callee.object.type !== "Identifier" ||
		callee.object.name !== "rateLimiter" ||
		callee.property.type !== "Identifier" ||
		callee.property.name !== "limit"
	) {
		return false;
	}

	const [firstArgument] = unwrapped.arguments;

	return firstArgument !== undefined && firstArgument.type !== "SpreadElement" && isCtxIdentifier(firstArgument);
}

function isPromiseAllOfAllowedCtxIo(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type !== "CallExpression") {
		return false;
	}

	const callee = unwrapExpression(unwrapped.callee);

	if (
		callee.type !== "MemberExpression" ||
		callee.computed ||
		callee.object.type !== "Identifier" ||
		callee.object.name !== "Promise" ||
		callee.property.type !== "Identifier" ||
		callee.property.name !== "all"
	) {
		return false;
	}

	const [firstArgument] = unwrapped.arguments;

	if (firstArgument === undefined || firstArgument.type === "SpreadElement") {
		return false;
	}

	const arrayExpression = unwrapExpression(firstArgument);

	if (arrayExpression.type !== "ArrayExpression") {
		return false;
	}

	return arrayExpression.elements.every((element) => {
		if (element === null || element.type === "SpreadElement") {
			return false;
		}

		const elementExpression = unwrapExpression(element);

		if (elementExpression.type === "ConditionalExpression") {
			const branches = [elementExpression.consequent, elementExpression.alternate];

			return branches.every((branch) => isAllowedCtxIoExpression(branch));
		}

		return isAllowedCtxIoExpression(elementExpression);
	});
}

function isAllowedCtxIoExpression(expression: ESTree.Expression): boolean {
	const root = stripPromiseChain(expression);

	if (isRateLimiterLimitOnCtx(root)) {
		return true;
	}

	if (isPromiseAllOfAllowedCtxIo(root)) {
		return true;
	}

	const ctxRoot = allowedCtxRootFromExpression(root);

	return ctxRoot !== null && (ALLOWED_CTX_ROOTS.has(ctxRoot) || ALLOWED_CTX_CALLS.has(ctxRoot));
}

/**
 * Heuristic: `okOrThrow` is only for a single Convex I/O promise at the call site (`ctx.db`, `ctx.scheduler`,
 * `ctx.auth`, `ctx.runQuery`, `ctx.runMutation`, including `.then` chains on those reads/writes).
 *
 * Narrow allowlist extensions (documented): `rateLimiter.limit(ctx, …)` and `Promise.all([…])` when every
 * element is ctx I/O (including simple ternaries). Legacy `okOrThrow(domainHelper())` call sites should be
 * refactored to `ResultAsync` callees during layer migration.
 */
export const noExportOkOrThrowOnCallRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow okOrThrow unless the argument is a direct Convex ctx I/O expression (db, scheduler, auth, runQuery, runMutation)."
		},
		messages: {
			notConvexIo:
				"`okOrThrow` must wrap a single Convex I/O promise (`ctx.db`, `ctx.scheduler`, `ctx.auth`, `ctx.runQuery`, `ctx.runMutation`). Callees that touch Stripe, DNS, fetch, or Drive should return `ResultAsync` and be chained with `.andThen`."
		}
	},
	createOnce(context) {
		return {
			CallExpression(node) {
				if (!isOkOrThrowCall(node)) {
					return;
				}

				const [firstArgument] = node.arguments;

				if (firstArgument === undefined || firstArgument.type === "SpreadElement") {
					return;
				}

				if (isAllowedCtxIoExpression(firstArgument)) {
					return;
				}

				context.report({ node, messageId: "notConvexIo" });
			}
		};
	}
});
