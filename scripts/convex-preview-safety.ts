import { z } from "zod";

// CI-only validation. Keep the required fields aligned with convex/env.ts,
// without importing or changing either application's environment loader.
const serverEnvSchema = z.object({
	CLERK_FRONTEND_API_URL: z.string().min(1),
	CLERK_SECRET_KEY: z.string().min(1),
	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	GOOGLE_REFRESH_TOKEN: z.string().min(1),
	GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().min(1),
	GOOGLE_CALENDAR_ID: z.string().min(1),
	GOOGLE_CALENDAR_AVAILABILITY_IDS: z.string().min(1).optional(),
	GOOGLE_CALENDAR_TIMEZONE: z.string().min(1),
	GOOGLE_CALENDAR_HOST_EMAILS: z.string().min(1),
	RESEND_API_KEY: z.string().min(1),
	RESEND_FROM_EMAIL: z.email().min(1),
	STRIPE_SECRET_KEY: z.string().min(1),
	STRIPE_WEBHOOK_SECRET: z.string().min(1),
	STRIPE_CHECKOUT_RETURN_URL: z.string().min(1)
});

export function validatePreviewKey(key: string | undefined) {
	if (!key || !/^preview:[^:|\s]+:[^:|\s]+\|[^\s]+$/.test(key)) {
		throw new Error(
			"CONVEX_E2E_PREVIEW_DEPLOY_KEY must be a project preview deploy key. No shared-backend fallback is allowed."
		);
	}
}

function requireTestKeys(secret: string, publishable: string | undefined, provider: string) {
	if (!secret.startsWith("sk_test_") || !(publishable ?? "").startsWith("pk_test_")) {
		throw new Error(`Preview ${provider} keys must be test keys.`);
	}
}

export function validatePreviewIntegrations(
	values: Record<string, string | undefined>,
	approved: {
		calendarId: string | undefined;
		driveFolderId: string | undefined;
		confirmed: string | undefined;
	},
	frontend: { stripeKey: string | undefined; clerkKey: string | undefined }
) {
	const parsed = serverEnvSchema.safeParse(values);

	if (!parsed.success) {
		const names = [...new Set(parsed.error.issues.map((issue) => issue.path[0]))];
		throw new Error(`Missing or invalid preview defaults: ${names.join(", ")}.`);
	}

	const env = parsed.data;
	requireTestKeys(env.STRIPE_SECRET_KEY, frontend.stripeKey, "Stripe");
	requireTestKeys(env.CLERK_SECRET_KEY, frontend.clerkKey, "Clerk");

	if (env.STRIPE_CHECKOUT_RETURN_URL !== "http://localhost:3000/booking-complete") {
		throw new Error("Preview Stripe return URL must target the local smoke-test app.");
	}

	const calendars = (env.GOOGLE_CALENDAR_AVAILABILITY_IDS ?? env.GOOGLE_CALENDAR_ID)
		.split(",")
		.map((id) => id.trim());

	if (
		!approved.calendarId ||
		env.GOOGLE_CALENDAR_ID !== approved.calendarId ||
		calendars.some((id) => id !== approved.calendarId)
	) {
		throw new Error(
			"Preview calendar and availability calendars must match E2E_GOOGLE_CALENDAR_ID."
		);
	}

	if (!approved.driveFolderId || env.GOOGLE_DRIVE_ROOT_FOLDER_ID !== approved.driveFolderId) {
		throw new Error("Preview Drive folder must match E2E_GOOGLE_DRIVE_ROOT_FOLDER_ID.");
	}

	if (approved.confirmed !== "true") {
		throw new Error(
			"Confirm test-only Google, Resend and Stripe webhook configuration with E2E_PREVIEW_INTEGRATIONS_CONFIRMED=true."
		);
	}
}
