import { defineRule } from "@oxlint/plugins";
import type { ESTree, Scope } from "@oxlint/plugins";

import { isConvexLibFile, isConvexServiceFile } from "../shared/paths.ts";

const ERROR_CONSTRUCTORS = new Set(["err", "errAsync"]);

function propertyName(node: ESTree.MemberExpression): string | null {
	if (!node.computed && node.property.type === "Identifier") return node.property.name;
	if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string")
		return node.property.value;
	return null;
}

/** Explicit skip sentinels are detectable; arbitrary domain reason semantics require review. */
export const noSyntheticSkipErrorRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Disallow explicit SKIP/SKIPPED errors used for successful control flow."
		},
		messages: {
			syntheticSkipError:
				"Do not represent a successful skip as an error. Keep real domain errors and return successful recovery values."
		}
	},
	create(context) {
		if (!isConvexLibFile(context.filename) && !isConvexServiceFile(context.filename)) return {};

		function resolve(node: ESTree.Node, seen = new Set<ESTree.Node>()): ESTree.Node {
			if (seen.has(node)) return node;
			seen.add(node);
			if (
				node.type === "TSAsExpression" ||
				node.type === "TSSatisfiesExpression" ||
				node.type === "TSNonNullExpression"
			) {
				return resolve(node.expression, seen);
			}
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
					) {
						return resolve(declaration.init, seen);
					}
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
		function isNeverthrowImport(node: ESTree.Node): boolean {
			return node.parent?.type === "ImportDeclaration" && node.parent.source.value === "neverthrow";
		}
		function isErrorConstructor(node: ESTree.Node): boolean {
			const callee = resolve(node);
			if (callee.type === "ImportSpecifier" && isNeverthrowImport(callee)) {
				const name =
					callee.imported.type === "Identifier" ? callee.imported.name : callee.imported.value;
				return ERROR_CONSTRUCTORS.has(name);
			}
			if (callee.type !== "MemberExpression") return false;
			const namespace = resolve(callee.object);
			return (
				namespace.type === "ImportNamespaceSpecifier" &&
				isNeverthrowImport(namespace) &&
				ERROR_CONSTRUCTORS.has(propertyName(callee) ?? "")
			);
		}
		function isSkipString(node: ESTree.Node): boolean {
			const value = resolve(node);
			return (
				value.type === "Literal" &&
				typeof value.value === "string" &&
				/^(?:SKIP|SKIPPED)(?:_|$)|(?:^|_)(?:SKIP|SKIPPED)$/iu.test(value.value)
			);
		}
		function hasSkipSentinel(node: ESTree.Node): boolean {
			const value = resolve(node);
			if (isSkipString(value)) return true;
			if (value.type !== "ObjectExpression") return false;
			return value.properties.some((property) => {
				if (property.type !== "Property" || property.kind !== "init") return false;
				const key =
					!property.computed && property.key.type === "Identifier"
						? property.key.name
						: property.key.type === "Literal"
							? property.key.value
							: null;
				return (key === "reason" || key === "kind") && isSkipString(property.value);
			});
		}
		return {
			CallExpression(node: ESTree.CallExpression) {
				const [argument] = node.arguments;
				if (
					isErrorConstructor(node.callee) &&
					argument &&
					argument.type !== "SpreadElement" &&
					hasSkipSentinel(argument)
				) {
					context.report({ node, messageId: "syntheticSkipError" });
				}
			}
		};
	}
});
