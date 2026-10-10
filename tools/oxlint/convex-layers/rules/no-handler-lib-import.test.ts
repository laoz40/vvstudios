import { RuleTester } from "oxlint/plugins-dev";

import { noHandlerLibImportRule } from "./no-handler-lib-import.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-handler-lib-import", noHandlerLibImportRule, {
	valid: [
		{
			filename: "convex/sessions/sessions.ts",
			code: `import { listSessionsService } from "#convex/sessions/services/sessions";`
		},
		{
			filename: "convex/booking/settings.ts",
			code: `import { loadBookingAvailabilitySettings } from "#convex/booking/services/bookingSettings";`
		},
		{
			filename: "convex/http.ts",
			code: `import { foo } from "#convex/lib/http/foo";`
		},
		{
			filename: "convex/sessions/sessionsDriveInternal.ts",
			code: `import { linkBookingDriveClient } from "#convex/drive/lib/driveBookingDriveClient";`
		},
		{
			filename: "convex/sessions/services/sessions.ts",
			code: `import { getSessionFromDb } from "#convex/sessions/lib/sessionLookup";`
		}
	],
	invalid: [
		{
			filename: "convex/sessions/sessions.ts",
			code: `import { getDriveSetup } from "#convex/drive/lib/driveLookup";`,
			errors: [{ messageId: "handlerLibImport" }]
		}
	]
});
