"use node";

import { google } from "googleapis";
import { env } from "#convex/env";

export function getGoogleOAuthClient() {
	const oauth2Client = new google.auth.OAuth2({
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET
	});
	oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
	return oauth2Client;
}
