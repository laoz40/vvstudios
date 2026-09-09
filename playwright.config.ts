import { defineConfig, devices } from "@playwright/test";
import { loadLocalEnvFilesFromModule } from "./scripts/load-env.ts";

loadLocalEnvFilesFromModule(import.meta.url);

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
