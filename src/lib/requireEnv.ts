const env = import.meta.env;

export type RequiredEnvKey =
	| "APP_CONTACT_EMAIL"
	| "APP_CONTACT_PHONE"
	| "APP_SCRIPT_URL"
	| "PUBLIC_BOOKING_COUCH_1_URL"
	| "PUBLIC_BOOKING_COUCH_2_URL"
	| "PUBLIC_BOOKING_COUCH_3_URL"
	| "PUBLIC_BOOKING_RECURRING_URL"
	| "PUBLIC_BOOKING_TABLE_1_URL"
	| "PUBLIC_BOOKING_TABLE_2_URL"
	| "PUBLIC_BOOKING_TABLE_3_URL"
	| "PUBLIC_FREE_TOUR_URL";

export const requireEnv = (name: RequiredEnvKey): string => {
	const value = env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
};
