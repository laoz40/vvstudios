import { eslintCompatPlugin } from "@oxlint/plugins";

import { noVagueFunctionNamesRule } from "./rules/no-vague-function-names.ts";

/** Oxlint rules that enforce concrete, action-specific function names. */
const namingPlugin = eslintCompatPlugin({
	meta: { name: "naming" },
	rules: { "no-vague-function-names": noVagueFunctionNamesRule }
});

export default namingPlugin;
