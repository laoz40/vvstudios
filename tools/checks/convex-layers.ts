import { checkConvexLayers } from "../oxlint/convex-layers/check-dependencies.ts";

const violations = checkConvexLayers(process.cwd());

for (const violation of violations) console.error(violation);

if (violations.length > 0) process.exitCode = 1;
