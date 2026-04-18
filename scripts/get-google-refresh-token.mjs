import fs from "node:fs";
import http from "node:http";
import path from "node:path";
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

const authUrl = oauth2Client.generateAuthUrl({
	access_type: "offline",
	prompt: "consent",
	scope: ["https://www.googleapis.com/auth/calendar"],
});

const redirectUrl = new URL(redirectUri);
const port = Number(redirectUrl.port || 80);
const origin = `${redirectUrl.protocol}//${redirectUrl.host}`;

const server = http.createServer(async (req, res) => {
	try {
		const reqUrl = new URL(req.url ?? "/", origin);

		if (reqUrl.pathname !== redirectUrl.pathname) {
			res.statusCode = 404;
			res.end("Not found");
			return;
		}

		const error = reqUrl.searchParams.get("error");
		if (error) {
			res.statusCode = 400;
			res.end(`Google returned an error: ${error}`);
			console.error("Google OAuth error:", error);
			server.close();
			return;
		}

		const code = reqUrl.searchParams.get("code");
		if (!code) {
			res.statusCode = 400;
			res.end("Missing code");
			return;
		}

		const { tokens } = await oauth2Client.getToken(code);

		res.statusCode = 200;
		res.setHeader("content-type", "text/plain; charset=utf-8");
		res.end("Success. Check your terminal for the refresh token. You can close this tab now.");

		console.log("\nGoogle OAuth tokens received.\n");
		console.log("Add this to your .env.local:\n");
		console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token ?? "<no refresh token returned>"}`);
		console.log("\nFull token payload:\n");
		console.dir(tokens, { depth: null });

		server.close();
	} catch (error) {
		res.statusCode = 500;
		res.setHeader("content-type", "text/plain; charset=utf-8");
		res.end("Failed to exchange authorization code. Check terminal logs.");
		console.error("Failed to get Google refresh token:", error);
		server.close();
	}
});

server.listen(port, () => {
	console.log("Google refresh token helper");
	console.log("===========================\n");
	console.log("Loaded env from .env.local / .env when available.\n");
	console.log(`1. Make sure this redirect URI is added in Google Cloud:`);
	console.log(`   ${redirectUri}\n`);
	console.log("2. Open this URL in your browser:\n");
	console.log(authUrl);
	console.log("\n3. Approve access with the Google account that owns the calendar.\n");
});

function loadEnvFiles() {
	const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
	const projectRoot = path.resolve(scriptDirectory, "..");

	for (const fileName of [".env.local", ".env"]) {
		loadEnvFile(path.join(projectRoot, fileName));
	}
}

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

function stripWrappingQuotes(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}
