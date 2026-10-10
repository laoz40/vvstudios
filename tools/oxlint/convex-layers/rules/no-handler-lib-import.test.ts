import { RuleTester } from "oxlint/plugins-dev";

import { noHandlerLibImportRule } from "./no-handler-lib-import.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-handler-lib-import", noHandlerLibImportRule, {
	valid: [
		{
			filename: "convex/sessions/admin.ts",
			code: `import { listSessionsService } from "#convex/sessions/services/adminList";`
		},
		{
			filename: "convex/booking/settings.ts",
			code: `import { loadBookingAvailabilitySettings } from "#convex/booking/services/settings";`
		},
		{
			filename: "convex/http.ts",
			code: `import { foo } from "#convex/lib/http/foo";`
		},
		{
			filename: "convex/sessions/drive.ts",
			code: `import { linkBookingDriveClient } from "#convex/drive/lib/driveBookingDriveClient";`
		},
		{
			filename: "convex/sessions/services/adminList.ts",
			code: `import { getSessionFromDb } from "#convex/sessions/lib/lookup";`
		}
	],
	invalid: [
		{
			filename: "convex/sessions/admin.ts",
			code: `import { getDriveSetup } from "#convex/drive/lib/driveLookup";`,
			errors: [{ messageId: "handlerLibImport" }]
		}
	]
});
