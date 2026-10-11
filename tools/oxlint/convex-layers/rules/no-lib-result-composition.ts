import { defineRule } from "@oxlint/plugins";
import type { ESTree, Scope } from "@oxlint/plugins";

import { isConvexLibFile } from "../shared/paths.ts";

const COMPOSITION_METHODS = new Set(["andThen", "asyncAndThen"]);

function propertyName(property: ESTree.Node, computed: boolean): string | null {
	if (!computed && property.type === "Identifier") return property.name;
	if (computed && property.type === "Literal" && typeof property.value === "string") {
		return property.value;
	}
	return null;
}

/** Keep multi-step Result composition in services, including composition of pure helpers. */
export const noLibResultCompositionRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow andThen, asyncAndThen, and safeTry in Convex lib. Simple map transformations remain allowed."
		},
		messages: {
			resultComposition:
				"Compose Result steps in a service. Do not use andThen or asyncAndThen in Convex lib, even for pure helpers.",
			safeTry:
				"Compose Result steps in a service. safeTry is not allowed in Convex lib."
		}
	},
	create(context) {
		if (!isConvexLibFile(context.filename)) return {};

		function reportComposition(node: ESTree.Node, name: string | null) {
			if (name !== null && COMPOSITION_METHODS.has(name)) {
				context.report({ node, messageId: "resultComposition" });
			} else if (name === "safeTry") {
				context.report({ node, messageId: "safeTry" });
			}
		}

		return {
			MemberExpression(node: ESTree.MemberExpression) {
				reportComposition(node, propertyName(node.property, node.computed));
			},
			Property(node) {
				if (node.parent.type === "ObjectPattern" && "key" in node && "computed" in node) {
					reportComposition(node, propertyName(node.key, node.computed));
				}
			},
			ImportSpecifier(node: ESTree.ImportSpecifier) {
				if (node.parent.type !== "ImportDeclaration" || node.parent.source.value !== "neverthrow")
					return;
				const name = node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
				if (name === "safeTry") context.report({ node, messageId: "safeTry" });
			},
			CallExpression(node: ESTree.CallExpression) {
				if (node.callee.type !== "Identifier" || node.callee.name !== "safeTry") return;
				// Named imports are reported at the import, without a duplicate at each call.
				for (
					let scope: Scope | null = context.sourceCode.getScope(node.callee);
					scope !== null;
					scope = scope.upper
				) {
					if (scope.set.has("safeTry")) return;
				}
				context.report({ node, messageId: "safeTry" });
			}
		};
	}
});
