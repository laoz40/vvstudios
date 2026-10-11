import { eslintCompatPlugin } from "@oxlint/plugins";

import { noDbInServicesRule } from "./rules/no-db-in-services.ts";
import { noServiceImplementationRule } from "./rules/no-service-implementation.ts";
import { noHandlerLibImportRule } from "./rules/no-handler-lib-import.ts";
import { noLibResultCompositionRule } from "./rules/no-lib-result-composition.ts";
import { pureValidationInLibOnlyRule } from "./rules/pure-validation-in-lib-only.ts";
import { noLibReexportRule } from "./rules/no-lib-reexport.ts";
import { noLibTestSetupImportRule } from "./rules/no-lib-test-setup-import.ts";
import { noDriveStateWriteOutsideOwnerRule } from "./rules/no-drive-state-write-outside-owner.ts";
import { noBillingRecoveryStateWriteOutsideOwnerRule } from "./rules/no-billing-recovery-state-write-outside-owner.ts";

import { noResultMatchOutsideHandlerRule } from "./rules/no-result-match-outside-handler.ts";
import { noTrivialResultWrapperRule } from "./rules/no-trivial-result-wrapper.ts";
import { noSyntheticSkipErrorRule } from "./rules/no-synthetic-skip-error.ts";

/** Oxlint rules enforcing Convex handler → service → lib layering. */
const convexLayersPlugin = eslintCompatPlugin({
	meta: { name: "convex-layers" },
	rules: {
		"no-result-match-outside-handler": noResultMatchOutsideHandlerRule,
		"no-trivial-result-wrapper": noTrivialResultWrapperRule,
		"no-synthetic-skip-error": noSyntheticSkipErrorRule,

		"no-db-in-services": noDbInServicesRule,
		"no-service-implementation": noServiceImplementationRule,
		"no-handler-lib-import": noHandlerLibImportRule,
		"pure-validation-in-lib-only": pureValidationInLibOnlyRule,
		"no-lib-result-composition": noLibResultCompositionRule,
		"no-lib-reexport": noLibReexportRule,
		"no-lib-test-setup-import": noLibTestSetupImportRule,
		"no-drive-state-write-outside-owner": noDriveStateWriteOutsideOwnerRule,
		"no-billing-recovery-state-write-outside-owner": noBillingRecoveryStateWriteOutsideOwnerRule
	}
});

export default convexLayersPlugin;
