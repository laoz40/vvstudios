import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

loadEnvFiles();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:3007/oauth2callback";

if (!clientId || !clientSecret) {
	throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const state = crypto.randomBytes(32).toString("hex");

const authUrl = oauth2Client.generateAuthUrl({
	access_type: "offline",
	include_granted_scopes: true,
	prompt: "consent",
	scope: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/drive"],
	state
});

console.log("Google refresh token helper");
console.log("===========================\n");
console.log("Loaded env from .env.local / .env when available.\n");
console.log("1. Make sure this redirect URI is added in Google Cloud:");
console.log(`   ${redirectUri}\n`);
console.log("2. Send this private authorization URL to the Google account owner:\n");
console.log(authUrl);
console.log("\n3. Ask them to approve Calendar and Drive access.");
console.log("4. Their final page may fail to load. Ask them to copy the complete URL");
console.log("   from their browser address bar and send it back to you immediately.\n");

const readline = createInterface({ input: process.stdin, output: process.stdout });

try {
	const callbackInput = await readline.question("Paste the complete callback URL here:\n> ");
	const callbackUrl = new URL(callbackInput.trim());
	const expectedRedirectUrl = new URL(redirectUri);

	if (
		callbackUrl.origin !== expectedRedirectUrl.origin ||
		callbackUrl.pathname !== expectedRedirectUrl.pathname
	) {
		throw new Error(`Expected a callback URL beginning with ${redirectUri}`);
	}

	if (callbackUrl.searchParams.get("state") !== state) {
		throw new Error("The callback URL did not match this authorization session.");
	}

	const oauthError = callbackUrl.searchParams.get("error");
	if (oauthError) {
		throw new Error(`Google returned an authorization error: ${oauthError}`);
	}

	const code = callbackUrl.searchParams.get("code");
	if (!code) {
		throw new Error("The callback URL does not contain an authorization code.");
	}

	const { tokens } = await oauth2Client.getToken(code);
	if (!tokens.refresh_token) {
		throw new Error(
			"Google did not return a refresh token. Run the helper again and approve access."
		);
	}

	console.log("\nAuthorization complete. Add this to the production Convex environment:\n");
	console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
} catch (error) {
	console.error("\nFailed to get a Google refresh token.");
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	readline.close();
}

function loadEnvFiles() {
	const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
	const projectRoot = path.resolve(scriptDirectory, "..");

	for (const fileName of [".env.local", ".env"]) {
		loadEnvFile(path.join(projectRoot, fileName));
	}
}

/** @param {string} filePath */
function loadEnvFile(filePath) {
	if (!fs.existsSync(filePath)) {
		return;
	}

	const fileContents = fs.readFileSync(filePath, "utf8");

	for (const line of fileContents.split(/\r?\n/u)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const equalsIndex = trimmedLine.indexOf("=");
		if (equalsIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, equalsIndex).trim();
		const rawValue = trimmedLine.slice(equalsIndex + 1).trim();
		if (!key || process.env[key] !== undefined) {
			continue;
		}

		process.env[key] = stripWrappingQuotes(rawValue);
	}
}

/** @param {string} value */
function stripWrappingQuotes(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}
