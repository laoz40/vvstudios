import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnvFiles } from "./scripts/load-env";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

loadLocalEnvFiles(projectRoot);

// CI has no .env files; Convex tests still import modules that read these at runtime.
const convexTestEnvDefaults = {
	CLERK_FRONTEND_API_URL: "https://test.clerk.accounts.dev",
	CLERK_SECRET_KEY: "sk_test_vitest",
	GOOGLE_CLIENT_ID: "vitest-google-client-id",
	GOOGLE_CLIENT_SECRET: "vitest-google-client-secret",
	GOOGLE_REFRESH_TOKEN: "vitest-google-refresh-token",
	GOOGLE_DRIVE_ROOT_FOLDER_ID: "vitest-drive-root-folder",
	GOOGLE_CALENDAR_ID: "vitest-calendar-id",
	GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney",
	GOOGLE_CALENDAR_HOST_EMAILS: "host@example.com",
	RESEND_API_KEY: "re_vitest",
	RESEND_FROM_EMAIL: "studio@example.com",
	STRIPE_SECRET_KEY: "sk_test_vitest",
	STRIPE_WEBHOOK_SECRET: "whsec_vitest",
	STRIPE_CHECKOUT_RETURN_URL: "https://example.com/booking/return"
} as const satisfies Record<string, string>;

for (const [key, value] of Object.entries(convexTestEnvDefaults)) {
	if (process.env[key] === undefined) {
		process.env[key] = value;
	}
}
