import type { ESTree } from "@oxlint/plugins";

export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
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
