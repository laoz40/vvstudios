import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		CLERK_FRONTEND_API_URL: z.string().min(1),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		GOOGLE_REFRESH_TOKEN: z.string().min(1),
		GOOGLE_CALENDAR_ID: z.string().min(1),
		GOOGLE_CALENDAR_TIMEZONE: z.string().min(1),
		GOOGLE_CALENDAR_HOST_EMAILS: z.string().min(1),
		RESEND_API_KEY: z.string().min(1),
		RESEND_FROM_EMAIL: z.email().min(1),
		STRIPE_SECRET_KEY: z.string().min(1),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
