/**
 * Pure lib test imports
 * Allows ordinary imports and permits Convex setup outside lib-test directories.
 *
 * Convex integration setup
 * Rejects alias and relative setup imports, re-exports, and dynamic imports in legacy,
 * feature, and shared lib-test directories.
 */
import { RuleTester } from "oxlint/plugins-dev";

import { noLibTestSetupImportRule } from "./no-lib-test-setup-import.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const libTest = `${process.cwd()}/convex/lib/tests/pure.test.ts`;
const featureLibTest = `${process.cwd()}/convex/booking/lib/tests/pure.test.ts`;
const sharedLibTest = `${process.cwd()}/convex/shared/lib/tests/pure.test.ts`;
const integrationTest = `${process.cwd()}/convex/tests/integration.test.ts`;

tester.run("convex-layers/no-lib-test-setup-import", noLibTestSetupImportRule, {
	valid: [
		{
			filename: libTest,
			code: `import { parse } from "#convex/booking/lib/parse";`
		},
		{
			filename: libTest,
			code: `import { setup } from "#convex/lib/test.setup";`
		},
		{
			filename: integrationTest,
			code: `import { createConvexTest } from "#convex/test.setup";`
		},
		{
			filename: libTest,
			code: `import { helper } from "../../services/test.setup";`
		},
		{
			filename: featureLibTest,
			code: `import { helper } from "#convex/booking/lib/parse";`
		},
		{
			filename: integrationTest,
			code: `import { createConvexTest } from "../test.setup";`
		}
	],
	invalid: [
		{
			filename: libTest,
			code: `import { createConvexTest } from "#convex/test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: libTest,
			code: `import { createConvexTest } from "#convex/test.setup.ts";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: featureLibTest,
			code: `import { createConvexTest } from "#convex/test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: featureLibTest,
			code: `import { createConvexTest } from "../../../test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: sharedLibTest,
			code: `import { createConvexTest } from "#convex/test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: sharedLibTest,
			code: `import { createConvexTest } from "../../../test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: libTest,
			code: `import { createConvexTest } from "../../test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: `${process.cwd()}/convex/lib/tests/nested/pure.test.ts`,
			code: `import { createConvexTest } from "../../../test.setup.js";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: libTest.replaceAll("/", "\\"),
			code: `import { createConvexTest } from "../../test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: libTest,
			code: `export { createConvexTest } from "../../test.setup";`,
			errors: [{ messageId: "libTestSetupImport" }]
		},
		{
			filename: libTest,
			code: `const setup = import("../../test.setup");`,
			errors: [{ messageId: "libTestSetupImport" }]
		}
	]
});
