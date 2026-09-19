import { eslintCompatPlugin } from "@oxlint/plugins";

import { noServiceErrorRemapSwitchRule } from "./rules/no-service-error-remap-switch.ts";

/** Oxlint rules for neverthrow service chains in Convex. */
const neverthrowPlugin = eslintCompatPlugin({
	meta: { name: "neverthrow" },
	rules: { "no-service-error-remap-switch": noServiceErrorRemapSwitchRule }
});

export default neverthrowPlugin;
