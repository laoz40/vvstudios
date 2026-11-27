import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const VAGUE_VERB_PREFIX = /^(prepare|process|manage|execute)(?=[A-Z]|$)/;

const ENSURE_PREFIX = /^ensure(?=[A-Z]|$)/;

const DOUBLE_VERB_RUN_PREFIX =
	/^run(Archive|Build|Cancel|Check|Complete|Create|Delete|Fetch|Get|Load|Reserve|Save|Schedule|Send|Sync|Update|Validate)(?=[A-Z]|$)/;

function getViolation(
	name: string
): { messageId: "vagueVerb" | "vagueEnsure" | "doubleVerbRun"; prefix: string } | null {
	const vagueMatch = VAGUE_VERB_PREFIX.exec(name);

	if (vagueMatch?.[1] !== undefined) {
		return { messageId: "vagueVerb", prefix: vagueMatch[1] };
	}

	if (ENSURE_PREFIX.test(name)) {
		return { messageId: "vagueEnsure", prefix: "ensure" };
	}

	const runMatch = DOUBLE_VERB_RUN_PREFIX.exec(name);

	if (runMatch?.[1] !== undefined) {
		return { messageId: "doubleVerbRun", prefix: `run${runMatch[1]}` };
	}

	return null;
}

function isFunctionInit(node: ESTree.Expression | null): boolean {
	return node !== null && (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression");
}

/** Reject vague verb prefixes and redundant run<Verb> wrappers on function declarations. */
export const noVagueFunctionNamesRule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow vague verb prefixes (prepare, process, manage, execute, ensure) and redundant run<Verb> prefixes on functions."
		},
		schema: [],
		messages: {
			vagueVerb:
				'Rename "{{name}}" to state the concrete action it performs (e.g. validate, build, fetch, send, record) instead of vague "{{prefix}}".',
			vagueEnsure:
				'Rename "{{name}}" using "require" for checks/guards or a concrete verb (e.g. getOrCreate, setup, grant) instead of "ensure".',
			doubleVerbRun:
				'Rename "{{name}}" by dropping the redundant "run" prefix from "{{prefix}}" and starting with the concrete verb.'
		}
	},
	createOnce(context) {
		const checkIdentifier = (node: ESTree.BindingIdentifier) => {
			const violation = getViolation(node.name);

			if (violation === null) return;

			context.report({
				node,
				messageId: violation.messageId,
				data: { name: node.name, prefix: violation.prefix }
			});
		};

		return {
			FunctionDeclaration(node) {
				if (node.id !== null) checkIdentifier(node.id);
			},
			VariableDeclarator(node) {
				if (node.id.type === "Identifier" && isFunctionInit(node.init)) {
					checkIdentifier(node.id);
				}
			}
		};
	}
});
