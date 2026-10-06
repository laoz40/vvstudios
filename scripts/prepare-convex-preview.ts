import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { validatePreviewIntegrations, validatePreviewKey } from "./convex-preview-safety";

// Convex runs this command after provisioning, but BEFORE deploying any code.
// Keep credentials in memory; never inherit env-list's stdout/stderr into CI logs.
try {
	validatePreviewKey(process.env.CONVEX_DEPLOY_KEY);
	const name = process.env.CONVEX_PREVIEW_NAME;

	if (!name || !/^e2e-pr-[1-9]\d*$/.test(name)) {
		throw new Error("Expected CONVEX_PREVIEW_NAME=e2e-pr-<PR number>.");
	}

	const url = process.env.VITE_CONVEX_URL;

	if (!url || !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.convex\.cloud$/.test(url)) {
		throw new Error("Convex did not provide a valid preview URL.");
	}

	const output = process.env.GITHUB_OUTPUT;

	if (!output) {
		throw new Error("GITHUB_OUTPUT is required to pass the preview URL to subsequent steps.");
	}

	const result = spawnSync("bunx", ["convex", "env", "list", "--deployment", `preview/${name}`], {
		encoding: "utf8",
		stdio: "pipe",
		timeout: 60_000
	});

	if (result.status !== 0) {
		throw new Error(
			"Unable to read preview environment defaults. Check the preview key and project configuration."
		);
	}

	validatePreviewIntegrations(
		parseEnv(result.stdout),
		{
			calendarId: process.env.E2E_GOOGLE_CALENDAR_ID,
			driveFolderId: process.env.E2E_GOOGLE_DRIVE_ROOT_FOLDER_ID,
			confirmed: process.env.E2E_PREVIEW_INTEGRATIONS_CONFIRMED
		},
		{
			stripeKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
			clerkKey: process.env.VITE_CLERK_PUBLISHABLE_KEY
		}
	);
	appendFileSync(output, `url=${url}\n`);
	console.log("Preview defaults passed the integration safety check.");
} catch (error) {
	console.error(error instanceof Error ? error.message : "Preview setup failed.");
	process.exitCode = 1;
}
