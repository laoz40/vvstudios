import { RuleTester } from "oxlint/plugins-dev";

import { noServiceErrorRemapSwitchRule } from "./no-service-error-remap-switch.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("neverthrow/no-service-error-remap-switch", noServiceErrorRemapSwitchRule, {
	valid: [
		`chain.mapErr(() => ({ reason: "INVOICE_SEND_FAILED" as const }));`,
		`chain.mapErr((error) => ({ reason: "INVOICE_SEND_FAILED" as const }));`,
		`okOrThrow(sendEmails()).andThen((emailResult) => emailResult).mapErr(() => ({ reason: "INVOICE_SEND_FAILED" as const }));`,
		`chain.mapErr((error) => {
      switch (error.reason) {
        case "BOOKING_NOT_FOUND":
          return { reason: "BOOKING_NOT_FOUND" as const };
        case "DRIVE_RECORD_NOT_FOUND":
          return { reason: "DRIVE_FOLDERS_NOT_READY" as const };
        default:
          return { reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const };
      }
    });`,
		`chain.mapErr(function (error) {
      switch (error.kind) {
        case "claim_failed":
          return error;
        default:
          return { kind: "completion_failed" as const, error };
      }
    });`,
		`chain.andThen((session) => ok(session));`,
		`fromConvexTuple(ctx.runMutation(internal.foo.bar, args)).mapErr((error) => ({ kind: "claim_failed" as const, error }));`,
		`chain.mapErr((error) => ({ kind: "claim_failed" as const, ...error }));`,
		`chain.mapErr((error) => [error, ...error]);`
	],
	invalid: [
		{
			code: `chain.mapErr((error) => error);`,
			errors: [{ messageId: "identityMapErr" }]
		},
		{
			code: `chain.mapErr((error) => {
        return error;
      });`,
			errors: [{ messageId: "identityMapErr" }]
		},
		{
			code: `chain.andThen((result) => result).mapErr((error) => error);`,
			errors: [{ messageId: "identityAndThenMapErr" }]
		},
		{
			code: `chain.mapErr((error) => {
        switch (error.reason) {
          case "NOT_AUTHENTICATED":
          case "BOOKING_NOT_FOUND":
            return error;
          default:
            return { reason: "RECEIPT_SEND_FAILED" as const };
        }
      });`,
			errors: [{ messageId: "remapSwitch" }]
		},
		{
			code: `chain.mapErr((error) => {
        switch (error.reason) {
          case "BOOKING_NOT_CONFIRMED":
            return error;
          case "RECEIPT_SEND_FAILED":
            return { reason: "RECEIPT_SEND_FAILED" as const };
          default:
            return { reason: "RECEIPT_SEND_FAILED" as const };
        }
      });`,
			errors: [{ messageId: "remapSwitch" }]
		},
		{
			code: `sendSessionReminderEmail({ email: "a@b.c" }).mapErr((emailError) => {
        console.error("send failed", emailError.reason);
        return { reason: "RESEND_SEND_FAILED" as const };
      });`,
			errors: [{ messageId: "collapseOnResultCall" }]
		},
		{
			code: `fromConvexTuple(ctx.runMutation(internal.foo.bar, args)).mapErr(() => ({ reason: "INVALID_BOOKING_DATA" as const }));`,
			errors: [{ messageId: "collapseOnResultCall" }]
		},
		{
			code: `getDateAvailabilityRange(startDate, endDate, timeZone).mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }));`,
			errors: [{ messageId: "collapseOnResultCall" }]
		},
		{
			code: `tryPromise({ try: () => fetch("/"), catch: () => ({ reason: "REQUEST_FAILED" as const }) }).mapErr(() => ({ reason: "INVOICE_SEND_FAILED" as const }));`,
			errors: [{ messageId: "collapseOnResultCall" }]
		}
	]
});
