import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { isConvexServiceFile } from "../shared/paths.ts";

function isCtxDbMember(node: ESTree.MemberExpression): boolean {
	return (
		node.object.type === "Identifier" &&
		node.object.name === "ctx" &&
		!node.computed &&
		node.property.type === "Identifier" &&
		node.property.name === "db"
	);
}

/** Services compose lib primitives; they must not touch ctx.db directly. */
export const noDbInServicesRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Disallow ctx.db reads and writes in convex/services/**."
		},
		messages: {
			dbInService:
				"Services must not use ctx.db. Move this database I/O to convex/lib and call it from the service."
		}
	},
	create(context) {
		if (!isConvexServiceFile(context.filename)) {
			return {};
		}

		return {
			MemberExpression(node: ESTree.MemberExpression) {
				if (!isCtxDbMember(node)) {
					return;
				}

				context.report({ node, messageId: "dbInService" });
			}
		};
	}
});
