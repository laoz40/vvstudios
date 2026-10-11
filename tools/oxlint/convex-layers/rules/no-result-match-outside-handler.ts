import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { isConvexHandlerFile } from "../shared/paths.ts";

const HANDLER_REGISTRARS = new Set([
	"action",
	"httpAction",
	"internalAction",
	"internalMutation",
	"internalQuery",
	"mutation",
	"query"
]);

function propertyName(property: ESTree.Node, computed: boolean): string | null {
	if (!computed && property.type === "Identifier") return property.name;
	if (computed && property.type === "Literal" && typeof property.value === "string") {
		return property.value;
	}
	return null;
}

function isRegexArgument(node: ESTree.Node | null | undefined): boolean {
	if (node === null || node === undefined) return false;
	if (node.type === "Literal") return "regex" in node;
	if (node.type === "NewExpression" || node.type === "CallExpression") {
		return node.callee.type === "Identifier" && node.callee.name === "RegExp";
	}
	return false;
}

function isConvexRuntimeFile(filename: string): boolean {
	const normalized = filename.replaceAll("\\", "/");
	return (
		/\/convex\//u.test(normalized) &&
		!/\/convex\/_generated\//u.test(normalized) &&
		!/\/convex\/.*\.(?:test|spec)\.tsx?$/u.test(normalized) &&
		!/\/convex\/.*\/(?:__tests__|tests?)\//u.test(normalized) &&
		!/\/convex\/test\.setup\.ts$/u.test(normalized)
	);
}

function isHandlerRegistrar(
	node: ESTree.Node,
	importedRegistrars: Set<string>,
	serverNamespaces: Set<string>
): boolean {
	if (node.type !== "CallExpression") return false;
	const callee = node.callee;
	if (callee.type === "Identifier") return importedRegistrars.has(callee.name);
	if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier") return false;
	const name = propertyName(callee.property, callee.computed);
	return name !== null && HANDLER_REGISTRARS.has(name) && serverNamespaces.has(callee.object.name);
}

function isRegisteredHandlerFunction(
	node: ESTree.Node,
	filename: string,
	importedRegistrars: Set<string>,
	serverNamespaces: Set<string>
): boolean {
	if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") return false;
	const normalized = filename.replaceAll("\\", "/");
	const isSpecialHandlerFile =
		normalized.endsWith("convex/http.ts") ||
		normalized.endsWith("convex/sessions/drive.ts") ||
		normalized.endsWith("convex/shared/auth.ts");
	if (
		!isSpecialHandlerFile &&
		!isConvexHandlerFile(normalized.startsWith("/") ? normalized : `/${normalized}`)
	) {
		return false;
	}
	const parent = node.parent;
	if (
		parent.type === "Property" &&
		parent.value === node &&
		parent.key.type === "Identifier" &&
		parent.key.name === "handler"
	) {
		const options = parent.parent;
		return (
			options.type === "ObjectExpression" &&
			isHandlerRegistrar(options.parent, importedRegistrars, serverNamespaces)
		);
	}
	return (
		parent.type === "CallExpression" &&
		parent.arguments.includes(node) &&
		isHandlerRegistrar(parent, importedRegistrars, serverNamespaces)
	);
}

function isTerminalTupleMatch(
	member: ESTree.Node,
	filename: string,
	importedRegistrars: Set<string>,
	serverNamespaces: Set<string>
): boolean {
	const call = member.parent;
	if (
		call === null ||
		call.type !== "CallExpression" ||
		call.callee !== member ||
		call.arguments.length !== 2
	) {
		return false;
	}
	const [okHandler, errHandler] = call.arguments;
	if (
		okHandler?.type !== "Identifier" ||
		okHandler.name !== "tupleOk" ||
		errHandler?.type !== "Identifier" ||
		errHandler.name !== "tupleErr"
	) {
		return false;
	}
	let expression: ESTree.Node = call;
	while (
		expression.parent?.type === "AwaitExpression" ||
		expression.parent?.type === "TSAsExpression" ||
		expression.parent?.type === "TSSatisfiesExpression" ||
		expression.parent?.type === "TSNonNullExpression"
	)
		expression = expression.parent;
	const returned = expression.parent;
	if (returned.type === "ArrowFunctionExpression") {
		return (
			returned.body === expression &&
			isRegisteredHandlerFunction(returned, filename, importedRegistrars, serverNamespaces)
		);
	}
	if (returned.type !== "ReturnStatement") return false;
	let fn: ESTree.Node = returned.parent;
	while (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") {
		if (fn.type === "Program") return false;
		fn = fn.parent;
	}
	return isRegisteredHandlerFunction(fn, filename, importedRegistrars, serverNamespaces);
}

function isWithinRegisteredHandler(
	node: ESTree.Node,
	filename: string,
	importedRegistrars: Set<string>,
	serverNamespaces: Set<string>
): boolean {
	for (let current = node; current.type !== "Program"; current = current.parent) {
		if (isRegisteredHandlerFunction(current, filename, importedRegistrars, serverNamespaces))
			return true;
	}
	return false;
}

/** Keep Result handling at handler boundaries, where a terminal tuple conversion can throw. */
export const noResultMatchOutsideHandlerRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow Result.match outside Convex handlers and constrain handler use to terminal tuple conversion."
		},
		messages: {
			resultMatch:
				"Do not use Result.match outside a Convex handler. Return the Result to a service caller for composition.",
			handlerResultMatch:
				"In a Convex handler, .match(tupleOk, tupleErr) must be the terminal expression of a return statement."
		}
	},
	create(context) {
		if (!isConvexRuntimeFile(context.filename)) return {};
		const importedRegistrars = new Set<string>();
		const serverNamespaces = new Set<string>();
		for (const statement of context.sourceCode.ast.body) {
			if (
				statement.type !== "ImportDeclaration" ||
				statement.source.value !== "#convex/_generated/server"
			) {
				continue;
			}
			for (const specifier of statement.specifiers) {
				if (specifier.type === "ImportNamespaceSpecifier") {
					serverNamespaces.add(specifier.local.name);
					continue;
				}
				if (specifier.type !== "ImportSpecifier") continue;
				const imported =
					specifier.imported.type === "Identifier"
						? specifier.imported.name
						: specifier.imported.value;
				if (HANDLER_REGISTRARS.has(imported)) importedRegistrars.add(specifier.local.name);
			}
		}

		function reportMatch(node: ESTree.Node) {
			if (
				!isWithinRegisteredHandler(node, context.filename, importedRegistrars, serverNamespaces)
			) {
				context.report({ node, messageId: "resultMatch" });
				return;
			}

			if (
				node.type !== "MemberExpression" ||
				!isTerminalTupleMatch(node, context.filename, importedRegistrars, serverNamespaces)
			) {
				context.report({ node, messageId: "handlerResultMatch" });
			}
		}

		return {
			MemberExpression(node: ESTree.MemberExpression) {
				if (propertyName(node.property, node.computed) !== "match") return;
				const call = node.parent;
				if (
					call.type === "CallExpression" &&
					call.callee === node &&
					isRegexArgument(call.arguments[0])
				) {
					return;
				}
				reportMatch(node);
			},
			Property(node: Extract<ESTree.Node, { type: "Property" }>) {
				if (node.parent.type !== "ObjectPattern") return;
				if (propertyName(node.key, node.computed) === "match") reportMatch(node);
			}
		};
	}
});
