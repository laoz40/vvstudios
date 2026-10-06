/**
 * Pure lib test imports
 * Allows lib helpers and permits Convex setup in the integration-test directory.
 *
 * Convex integration setup
 * Rejects alias and relative setup imports, re-exports, and dynamic imports in lib tests.
 */
import { RuleTester } from "oxlint/plugins-dev";

import { noLibTestSetupImportRule } from "./no-lib-test-setup-import.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const libTest = `${process.cwd()}/convex/lib/tests/pure.test.ts`;
const integrationTest = `${process.cwd()}/convex/tests/integration.test.ts`;

tester.run("convex-layers/no-lib-test-setup-import", noLibTestSetupImportRule, {
	valid: [
		{
			filename: libTest,
			code: `import { parse } from "#convex/lib/booking/parse";`
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
