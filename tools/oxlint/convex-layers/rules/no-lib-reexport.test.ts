import { RuleTester } from "oxlint/plugins-dev";

import { noLibReexportRule } from "./no-lib-reexport.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-lib-reexport", noLibReexportRule, {
	valid: [
		{
			filename: "convex/services/auth.ts",
			code: `import { requireUser as requireUserLib } from "#convex/shared/lib/auth";
export function requireUser(ctx) { return requireUserLib(ctx); }`
		}
	],
	invalid: [
		{
			filename: "convex/services/auth.ts",
			code: `export { getEditorByToken } from "#convex/shared/lib/auth";`,
			errors: [{ messageId: "libReexportFrom" }]
		},
		{
			filename: "convex/services/auth.ts",
			code: `import { getEditorByToken } from "#convex/shared/lib/auth";
export { getEditorByToken };`,
			errors: [{ messageId: "libReexportBinding" }]
		}
	]
});
