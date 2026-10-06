import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		maxWorkers: 4,
		exclude: ["**/node_modules/**", "**/tools/oxlint/**", "e2e/**/*.spec.ts"],
		setupFiles: ["./vitest.setup.ts"]
	}
});
