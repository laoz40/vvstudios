import { eslintCompatPlugin } from "@oxlint/plugins";

import { noDbInServicesRule } from "./rules/no-db-in-services.ts";
import { noHandlerLibImportRule } from "./rules/no-handler-lib-import.ts";
import { noLibLoaderOrchestrationRule } from "./rules/no-lib-loader-orchestration.ts";
import { noLibReexportRule } from "./rules/no-lib-reexport.ts";

/** Oxlint rules enforcing Convex handler → service → lib layering. */
const convexLayersPlugin = eslintCompatPlugin({
	meta: { name: "convex-layers" },
	rules: {
		"no-db-in-services": noDbInServicesRule,
		"no-handler-lib-import": noHandlerLibImportRule,
		"no-lib-loader-orchestration": noLibLoaderOrchestrationRule,
		"no-lib-reexport": noLibReexportRule
	}
});

export default convexLayersPlugin;
