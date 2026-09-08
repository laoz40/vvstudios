import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		exclude: ["**/node_modules/**", "**/tools/oxlint/**", "e2e/**"]
	}
});
