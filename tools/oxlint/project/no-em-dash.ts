import { defineRule } from "@oxlint/plugins";

/** Reject em dashes anywhere in source text, including comments and JSX. */
export const noEmDashRule = defineRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallow em dashes in source text." },
		schema: [],
		messages: { emDash: "Remove the em dash. Rewrite the sentence using a period or comma." }
	},
	createOnce(context) {
		return {
			Program() {
				for (const match of context.sourceCode.text.matchAll(/\u2014/g)) {
					context.report({
						loc: {
							start: context.sourceCode.getLocFromIndex(match.index),
							end: context.sourceCode.getLocFromIndex(match.index + 1)
						},
						messageId: "emDash"
					});
				}
			}
		};
	}
});
