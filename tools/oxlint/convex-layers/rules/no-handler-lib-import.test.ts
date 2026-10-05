import { RuleTester } from "oxlint/plugins-dev";

import { noHandlerLibImportRule } from "./no-handler-lib-import.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-handler-lib-import", noHandlerLibImportRule, {
	valid: [
		{
			filename: "convex/sessions.ts",
			code: `import { listSessionsService } from "#convex/services/sessions/sessions";`
		},
		{
			filename: "convex/http.ts",
			code: `import { foo } from "#convex/lib/http/foo";`
		},
		{
			filename: "convex/services/sessions/sessions.ts",
			code: `import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";`
		}
	],
	invalid: [
		{
			filename: "convex/sessionsDriveInternal.ts",
			code: `import { getDriveSetup } from "#convex/lib/drive/driveLookup";`,
			errors: [{ messageId: "handlerLibImport" }]
		}
	]
});
