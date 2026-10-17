---
name: convex
description:
  Routes general Convex requests to the right project skill. Use when the user
  asks which Convex skill to use or gives an underspecified Convex app task.
---

# Convex

Use this as the routing skill for Convex work in this repo.

If a more specific Convex skill clearly matches the request, use that instead.

## Start Here

If the project does not already have Convex AI guidance installed, or the
existing guidance looks stale, strongly recommend installing it first.

Preferred:

```bash
npx convex ai-files install
```

This installs or refreshes the managed Convex AI files. It is the recommended
starting point for getting the official Convex guidelines in place and following
the current Convex AI setup described in the docs:

- [Convex AI docs](https://docs.convex.dev/ai)

Simple fallback:

- [convex_rules.txt](https://convex.link/convex_rules.txt)

Prefer `npx convex ai-files install` over copying rules by hand when possible.

## Route to the Right Skill

Choose the guidance or skill that matches the task:

- Convex setup: read the [Convex guidelines](../../../convex/_generated/ai/guidelines.md), then the [project Convex guide](../../../docs/convex-three-layers.md), before implementing.
- Authentication setup: read the [authentication guidelines](../../../convex/_generated/ai/guidelines.md#authentication-guidelines) and apply the [project layer rules](../../../docs/convex-three-layers.md).
- Building a reusable Convex component: [convex-create-component](../convex-create-component/SKILL.md)
- Planning or running a migration: [convex-migration-helper](../convex-migration-helper/SKILL.md)
- Investigating performance issues: [convex-performance-audit](../convex-performance-audit/SKILL.md)

Read the linked guidance or use the matching skill before starting the task.

## When Not to Use

- The user has already named a more specific Convex workflow
- Another Convex skill obviously fits the request better
