import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

loadLocalEnvFiles();

const port = 3000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
	use: { baseURL, trace: "retain-on-failure", timezoneId: "Australia/Sydney" },
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "bun run dev",
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe"
	}
});

function loadLocalEnvFiles() {
	const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

	for (const fileName of [".env.local", ".env"]) {
		loadEnvFile(path.join(projectRoot, fileName));
	}
}

function loadEnvFile(filePath: string) {
	if (!fs.existsSync(filePath)) {
		return;
	}

	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
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

function stripWrappingQuotes(value: string) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}
