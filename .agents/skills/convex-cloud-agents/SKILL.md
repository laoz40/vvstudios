---
name: convex-cloud-agents
description:
  Guidelines for working on Convex changes without conflicting with other
  deployments. Use for cloud agents working on Convex in an isolated VM.
---

# Convex cloud agents

## Small changes

For small Convex work (handler or query tweaks, no schema change, no shared-deployment push or data clash with another session), an isolated deployment is not necessary. Push with `npx convex dev --once` against the project's normal dev deployment.

## Isolated dev deployment

For major planned Convex changes that could conflict with other deployments, use an isolated cloud dev deployment for the branch:

```bash
npx convex deployment create --type dev --select \
  laoz40:vv-podcast-studio:dev/agent/$(basename "$PWD") \
  --expiration "in 5 days"
npx convex deployment token create agent-token --save-env
npx convex dev --once
```

On schema or data-shape changes, if an empty DB from a new dev deployment would miss breakage (e.g. optional→required, removed fields, indexes assuming existing docs), add a temporary internal seed mutation before the changes, run it with `npx convex dev --once --run path:seedFn`, exercise the change, then remove the seed before finishing.
