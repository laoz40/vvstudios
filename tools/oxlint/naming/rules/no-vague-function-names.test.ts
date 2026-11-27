import { RuleTester } from "oxlint/plugins-dev";

import { noVagueFunctionNamesRule } from "./no-vague-function-names.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("naming/no-vague-function-names", noVagueFunctionNamesRule, {
	valid: [
		"function validateFreeRevisionSubmission() {}",
		"function sendRevisionRequestedEmailAndRecordStatus() {}",
		"function fetchRevisionRequestedEmailData() {}",
		"function runEditorAccessSetup() {}",
		"const getRevisionEmailRecipients = () => [];",
		"const processCount = 1;"
	],
	invalid: [
		{
			code: "function prepareFreeRevisionSubmission() {}",
			errors: [{ messageId: "vagueVerb" }]
		},
		{
			code: "function processRevisionRequestedNotification() {}",
			errors: [{ messageId: "vagueVerb" }]
		},
		{
			code: "const manageSession = () => {};",
			errors: [{ messageId: "vagueVerb" }]
		},
		{
			code: "const executeSync = function () {};",
			errors: [{ messageId: "vagueVerb" }]
		},
		{
			code: "function ensureRescheduleSlotAvailable() {}",
			errors: [{ messageId: "vagueEnsure" }]
		},
		{
			code: "function runGetRevisionNotificationContext() {}",
			errors: [{ messageId: "doubleVerbRun" }]
		},
		{
			code: "export function runArchivePastDeadCheckoutBatch() {}",
			errors: [{ messageId: "doubleVerbRun" }]
		}
	]
});
