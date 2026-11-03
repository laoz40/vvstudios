import { eslintCompatPlugin } from "@oxlint/plugins";

import { noEmDashRule } from "./no-em-dash.ts";

const projectPlugin = eslintCompatPlugin({
	meta: { name: "project" },
	rules: { "no-em-dash": noEmDashRule }
});

export default projectPlugin;
