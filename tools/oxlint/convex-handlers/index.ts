import { eslintCompatPlugin } from "@oxlint/plugins";

import { noRootLibImportRule } from "./rules/no-root-lib-import.ts";

/** Oxlint rules for Convex handler module boundaries. */
const convexHandlersPlugin = eslintCompatPlugin({
	meta: { name: "convex-handlers" },
	rules: { "no-root-lib-import": noRootLibImportRule }
});

export default convexHandlersPlugin;
