import { defineRule } from "@oxlint/plugins";
import type { ESTree, Scope } from "@oxlint/plugins";
import { isConvexServiceFile } from "../shared/paths.ts";

/** Services compose operations; domain branching and I/O belong in lib. */
export const noServiceImplementationRule = defineRule({
	meta: {
		type: "problem",
		docs: { description: "Keep domain branching and raw I/O out of Convex services." },
		messages: {
			implementation:
				"Move domain branching and raw I/O into lib. Services compose operations and may inline simple mappings and arguments.",
			callbackDispatch:
				"Keep operation selection, conditional calls, filtering, and bound callbacks out of services. Compose meaningful lib operations directly; inline value mappings remain allowed."
		}
	},
	create(context) {
		if (!isConvexServiceFile(context.filename)) return {};
		function report(node: ESTree.Node) {
			context.report({ node, messageId: "implementation" });
		}
		const reported = new Set<ESTree.Node>();
		function reportDispatch(node: ESTree.Node) {
			if (reported.has(node)) return;
			reported.add(node);
			context.report({ node, messageId: "callbackDispatch" });
		}
		function resolve(node: ESTree.Node, seen = new Set<ESTree.Node>()): ESTree.Node {
			if (seen.has(node)) return node;
			seen.add(node);
			if (
				node.type === "TSAsExpression" ||
				node.type === "TSSatisfiesExpression" ||
				node.type === "TSNonNullExpression" ||
				node.type === "ChainExpression"
			)
				return resolve(node.expression, seen);
			if (node.type !== "Identifier") return node;
			for (
				let scope: Scope | null = context.sourceCode.getScope(node);
				scope;
				scope = scope.upper
			) {
				const variable = scope.set.get(node.name);
				if (!variable) continue;
				for (const definition of variable.defs) {
					if (
						definition.node.type === "VariableDeclarator" &&
						definition.node.id.type === "Identifier" &&
						definition.node.init
					) {
						return resolve(definition.node.init, seen);
					}
				}
				break;
			}
			return node;
		}
		function destructuredSelection(
			node: ESTree.Node
		): { name: string | null; object: ESTree.Node } | null {
			if (node.type !== "Identifier") return null;
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
						declaration.type !== "VariableDeclarator" ||
						declaration.id.type !== "ObjectPattern" ||
						!declaration.init
					)
						continue;
					for (const property of declaration.id.properties) {
						if (
							property.type !== "Property" ||
							property.value.type !== "Identifier" ||
							property.value.name !== node.name
						)
							continue;
						const name =
							!property.computed && property.key.type === "Identifier"
								? property.key.name
								: property.key.type === "Literal" && typeof property.key.value === "string"
									? property.key.value
									: null;
						return { name, object: resolve(declaration.init) };
					}
				}
				break;
			}
			return null;
		}
		function isSelectedOperation(node: ESTree.Node, seen = new Set<ESTree.Node>()): boolean {
			const value = resolve(node);
			if (seen.has(value)) return false;
			seen.add(value);
			const selection = destructuredSelection(value);
			if (
				selection &&
				(selection.object.type === "ObjectExpression" ||
					selection.name === "filter" ||
					selection.name === "bind" ||
					isSelectedOperation(selection.object, seen))
			)
				return true;
			if (value.type === "ConditionalExpression" || value.type === "LogicalExpression") return true;
			if (value.type !== "MemberExpression") return false;
			// Computed invocation with a dynamic key selects an operation. Static
			// member calls remain allowed unless they select from a local table.
			if (value.computed && value.property.type !== "Literal") return true;
			if (resolve(value.object).type === "ObjectExpression") return true;
			return isSelectedOperation(value.object, seen);
		}
		function methodName(node: ESTree.MemberExpression): string | null {
			if (!node.computed && node.property.type === "Identifier") return node.property.name;
			if (
				node.computed &&
				node.property.type === "Literal" &&
				typeof node.property.value === "string"
			) {
				return node.property.value;
			}
			return null;
		}
		function isNeverthrowSafeTry(node: ESTree.Node) {
			if (node.type === "MemberExpression") {
				return methodName(node) === "safeTry" && isNeverthrowImport(node.object, null);
			}
			return isNeverthrowImport(node, "safeTry");
		}
		function isNeverthrowImport(node: ESTree.Node, name: string | null) {
			node = resolve(node);
			if (node.type !== "Identifier") return false;
			for (
				let scope: Scope | null = context.sourceCode.getScope(node);
				scope;
				scope = scope.upper
			) {
				const variable = scope.set.get(node.name);
				if (!variable) continue;
				return variable.defs.some(({ node: declaration }) => {
					if (
						declaration.parent?.type !== "ImportDeclaration" ||
						declaration.parent.source.value !== "neverthrow"
					)
						return false;
					if (name === null) return declaration.type === "ImportNamespaceSpecifier";
					return (
						declaration.type === "ImportSpecifier" &&
						(declaration.imported.type === "Identifier"
							? declaration.imported.name
							: declaration.imported.value) === name
					);
				});
			}
			return false;
		}
		function isInsideSafeTryGenerator(node: ESTree.Node) {
			for (let parent: ESTree.Node | null = node.parent; parent; parent = parent.parent) {
				if (parent.type === "ArrowFunctionExpression" || parent.type === "FunctionDeclaration") {
					return false;
				}
				if (parent.type === "FunctionExpression") {
					const call = parent.parent;
					return (
						parent.generator &&
						call.type === "CallExpression" &&
						call.arguments[0] === parent &&
						isNeverthrowSafeTry(call.callee)
					);
				}
			}
			return false;
		}
		function hasOptionalAccess(node: ESTree.Node): boolean {
			if (node.type === "ChainExpression") return hasOptionalAccess(node.expression);
			if (node.type === "MemberExpression") return node.optional || hasOptionalAccess(node.object);
			if (node.type === "CallExpression") return node.optional || hasOptionalAccess(node.callee);
			return false;
		}
		function reportConditionalCall(node: ESTree.Node) {
			let child = node;
			for (let parent = node.parent; parent; parent = parent.parent) {
				if (parent.type === "ConditionalExpression") reportDispatch(parent);
				if (parent.type === "LogicalExpression" && parent.right === child) reportDispatch(parent);
				// Calls in a function's body are not executed by a surrounding value
				// expression. Selecting the function is checked at its use instead.
				if (
					parent.type === "ArrowFunctionExpression" ||
					parent.type === "FunctionExpression" ||
					parent.type === "FunctionDeclaration"
				)
					break;
				child = parent;
			}
		}
		return {
			CallExpression(node: ESTree.CallExpression) {
				reportConditionalCall(node);
				if (isSelectedOperation(node.callee)) reportDispatch(node);
				const callee = resolve(node.callee);
				if (callee.type === "CallExpression") reportDispatch(node);
				if (node.optional || hasOptionalAccess(callee)) reportDispatch(node);
				if (callee.type === "MemberExpression") {
					const method = methodName(callee);
					if (method === "filter" || method === "bind") reportDispatch(node);
					if (
						["andThen", "asyncAndThen", "map", "mapErr", "orElse", "reduce", "forEach"].includes(
							method ?? ""
						)
					) {
						for (const argument of node.arguments) {
							if (isSelectedOperation(argument)) reportDispatch(argument);
						}
					}
				}
				if (callee.type === "MemberExpression") {
					const method = methodName(callee);
					const owner = resolve(callee.object);
					if (owner.type === "MemberExpression" && resolve(owner.object).type === "Identifier") {
						const base = resolve(owner.object);
						if (
							base.type === "Identifier" &&
							base.name === "ctx" &&
							["scheduler", "auth"].includes(methodName(owner) ?? "")
						)
							report(node);
					}
					if (["runQuery", "runMutation", "runAction"].includes(method ?? "")) report(node);
				}
			},
			IfStatement: report,
			SwitchStatement: report,
			ForStatement: report,
			ForInStatement: report,
			ForOfStatement(node: ESTree.ForOfStatement) {
				if (
					node.await ||
					node.left.type !== "VariableDeclaration" ||
					node.left.kind !== "const" ||
					!isInsideSafeTryGenerator(node)
				)
					report(node);
			},
			WhileStatement: report,
			DoWhileStatement: report,
			TryStatement: report,
			ThrowStatement: report,
			AwaitExpression: report,
			YieldExpression(node: ESTree.YieldExpression) {
				if (!node.delegate || !isInsideSafeTryGenerator(node)) report(node);
			},
			NewExpression: report,
			AssignmentExpression: report,
			UpdateExpression: report
		};
	}
});
