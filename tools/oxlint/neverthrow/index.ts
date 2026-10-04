import { eslintCompatPlugin } from "@oxlint/plugins";

import { noExportOkOrThrowOnCallRule } from "./rules/no-export-okorthrow-on-call.ts";
import { noServiceErrorRemapSwitchRule } from "./rules/no-service-error-remap-switch.ts";
import { noTryPromiseRethrowRule } from "./rules/no-trypromise-rethrow.ts";

/** Oxlint rules for neverthrow service chains in Convex. */
const neverthrowPlugin = eslintCompatPlugin({
	meta: { name: "neverthrow" },
	rules: {
		"no-export-okorthrow-on-call": noExportOkOrThrowOnCallRule,
		"no-service-error-remap-switch": noServiceErrorRemapSwitchRule,
		"no-trypromise-rethrow": noTryPromiseRethrowRule
	}
});

export default neverthrowPlugin;
