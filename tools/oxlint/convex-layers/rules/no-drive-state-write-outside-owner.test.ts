import { RuleTester } from "oxlint/plugins-dev";

import { noDriveStateWriteOutsideOwnerRule } from "./no-drive-state-write-outside-owner.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("convex-layers/no-drive-state-write-outside-owner", noDriveStateWriteOutsideOwnerRule, {
	valid: [
		{
			filename: "convex/drive/lib/driveFolders.ts",
			code: `ctx.db.patch("driveClients", id, { assetsFolder });`
		},
		{
			filename: "convex/drive/lib/driveBookingDriveClient.ts",
			code: `ctx.db.patch("bookings", id, { driveClientId });`
		},
		{
			filename: "convex/drive/lib/driveFolders.ts",
			code: `ctx.db.patch("bookings", id, { driveSetupFailureCode: failureCode });`
		},
		{
			filename: "convex/sessions/lib/pendingCheckoutSession.ts",
			code: `ctx.db.insert("bookings", { ...{ driveClientId } });`
		},
		{
			filename: "convex/sessions/lib/schedulingSave.ts",
			code: `ctx.db.patch("bookings", id, { ...ordinaryBookingFields });`
		},
		{
			filename: "convex/booking/lib/confirmationSave.ts",
			code: `ctx.db.patch("bookings", id, { price: 420, status: "confirmed" });`
		},
		{
			filename: "convex/tests/driveInternal.test.ts",
			code: `ctx.db.insert("driveSessions", fixture);`
		}
	],
	invalid: [
		{
			filename: "convex/services/drive/driveInternal.ts",
			code: `ctx.db.patch("driveSessions", id, { sessionFolder });`,
			errors: [{ messageId: "driveTableWrite" }]
		},
		{
			filename: "convex/services/drive/driveInternal.ts",
			code: `ctx.db["delete"]("driveClientEditorPermissions", id);`,
			errors: [{ messageId: "driveTableWrite" }]
		},
		{
			filename: "convex/services/drive/driveInternal.ts",
			code: `ctx["db"]["replace"](\`driveSessions\`, id, {});`,
			errors: [{ messageId: "driveTableWrite" }]
		},
		{
			filename: "convex/sessions/lib/schedulingSave.ts",
			code: `ctx.db.patch("bookings", id, { ["driveSetupFailureCode"]: code });`,
			errors: [{ messageId: "bookingDriveFailure" }]
		},
		{
			filename: "convex/booking/lib/confirmationSave.ts",
			code: `ctx.db.patch("bookings", id, { ...{ driveClientId } });`,
			errors: [{ messageId: "bookingDriveClientId" }]
		},
		{
			filename: "convex/services/drive/driveInternal.ts",
			code: `ctx.db.insert("driveClients", {});`,
			errors: [{ messageId: "driveTableWrite" }]
		},
		{
			filename: "convex/drive/lib/driveEditor.ts",
			code: `ctx.db.patch("driveClients", id, {});`,
			errors: [{ messageId: "driveTableWrite" }]
		},
		{
			filename: "convex/drive/lib/driveFolders.ts",
			code: `ctx.db.insert("driveClientEditorPermissions", {});`,
			errors: [{ messageId: "driveTableWrite" }]
		},
		{
			filename: "convex/booking/lib/confirmationSave.ts",
			code: `ctx.db.delete("driveSessions", id);`,
			errors: [{ messageId: "driveTableWrite" }]
		}
	]
});
