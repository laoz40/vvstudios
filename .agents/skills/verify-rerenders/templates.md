# Verify re-renders templates

Copy and adapt. Delete all of this when the task is done.

## `src/lib/render-profiler.tsx`

```tsx
import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";

type RenderLogEntry = {
	id: string;
	phase: "mount" | "update" | "nested-update";
	actualDuration: number;
	baseDuration: number;
	startTime: number;
	commitTime: number;
};

declare global {
	interface Window {
		__renderLog?: RenderLogEntry[];
		__clearRenderLog?: () => void;
	}
}

const onRender: ProfilerOnRenderCallback = (
	id,
	phase,
	actualDuration,
	baseDuration,
	startTime,
	commitTime
) => {
	window.__renderLog ??= [];
	window.__renderLog.push({
		id,
		phase,
		actualDuration,
		baseDuration,
		startTime,
		commitTime
	});
};

export function installRenderProfiler() {
	window.__clearRenderLog = () => {
		window.__renderLog = [];
	};
}

export function RenderProfiler({ id, children }: { id: string; children: ReactNode }) {
	if (!import.meta.env.DEV) {
		return children;
	}

	return (
		<Profiler
			id={id}
			onRender={onRender}>
			{children}
		</Profiler>
	);
}
```

## Bootstrap (once, dev only)

In the app root or route shell:

```tsx
import { installRenderProfiler, RenderProfiler } from "#/lib/render-profiler";

if (import.meta.env.DEV) {
	installRenderProfiler();
}
```

Wrap a subtree:

```tsx
<RenderProfiler id="BookingForm">
	<BookingForm />
</RenderProfiler>
```

## `scripts/profiler-check.ts`

```ts
import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

async function main() {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	await page.goto(`${BASE_URL}/book`);
	await page.getByRole("heading", { name: /book/i }).waitFor();

	await page.evaluate(() => window.__clearRenderLog?.());

	// Interaction under test — edit per task
	await page.getByRole("button", { name: "Next" }).click();
	await page.getByRole("heading", { name: /select a date/i }).waitFor();

	const log = await page.evaluate(() => window.__renderLog ?? []);
	const updates = log.filter((entry) => entry.phase === "update");

	const counts = updates.reduce<Record<string, number>>((acc, entry) => {
		acc[entry.id] = (acc[entry.id] ?? 0) + 1;
		return acc;
	}, {});

	console.log(JSON.stringify({ updates, counts }, null, 2));

	await browser.close();
}

void main();
```

Run with dev server up:

```bash
bun run dev   # separate terminal
bun scripts/profiler-check.ts
```

## Summarize helper (inline in check script)

```ts
function summarize(log: Array<{ id: string; phase: string; actualDuration: number }>) {
	const updates = log.filter((e) => e.phase === "update");
	const byId = new Map<string, { count: number; duration: number }>();

	for (const entry of updates) {
		const current = byId.get(entry.id) ?? { count: 0, duration: 0 };
		byId.set(entry.id, {
			count: current.count + 1,
			duration: current.duration + entry.actualDuration
		});
	}

	return Object.fromEntries(byId);
}
```
