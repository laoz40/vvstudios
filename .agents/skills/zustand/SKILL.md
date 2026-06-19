---
name: zustand
description: Use when adding/refactoring Zustand state, reducing prop drilling, creating or editing *store* files, moving feature state/actions out of React components, or centralizing feature modals in a Zustand modal host.
---

# Zustand

## Purpose

Use this skill to add Zustand global state in this project while keeping state close to the related feature.

Preferred pattern:

- Put the store in the nearest related `lib` directory.
- Include `store` in the filename.
- Keep the Zustand store focused on data only.
- Components read data with `useFeatureStore((state) => state.value)` selectors.
- Export actions as plain functions outside the store for writing data.
- Action functions may use `useFeatureStore.setState((state) => ({ ... }))` for updates based on current state.
- Components pass no-argument actions directly to handlers like `onClick={increment}`.


Optional deeper pattern: when centralizing feature modals with a host component and discriminated `switch` states, also read [MODAL_HOST.md](MODAL_HOST.md).
## Store shape

Create a small focused store file near the feature, for example:

```ts
// src/features/counter/lib/counter-store.ts
import { create } from "zustand";

export type CounterStoreState = {
  count: number;
};

const initialState: CounterStoreState = {
  count: 0,
};

export const useCounterStore = create<CounterStoreState>(() => initialState);

export function increment() {
  useCounterStore.setState((state) => ({ count: state.count + 1 }));
}

export function decrement() {
  useCounterStore.setState((state) => ({ count: state.count - 1 }));
}

export function resetCounterStore() {
  useCounterStore.setState(initialState);
}
```

## Component usage

Read data with a store selector. Call exported actions directly.

```tsx
import { decrement, increment, resetCounterStore, useCounterStore } from "@/features/counter/lib/counter-store";

export function CounterControls() {
  const count = useCounterStore((state) => state.count);

  return (
    <div>
      <p>{count}</p>
      <button onClick={decrement}>- 1</button>
      <button onClick={resetCounterStore}>Reset</button>
      <button onClick={increment}>+ 1</button>
    </div>
  );
}
```

## Rules

- Do not put actions inside the Zustand state object unless the user asks for that pattern.
- Do not create one giant app-wide store if the state belongs to one feature.
- Do not duplicate server state that already comes from Convex or another data source unless there is a clear local UI-state need.
- Use store selectors for reads and exported action functions for writes.
- Keep initial state as a named constant when reset behavior is needed.
- Prefer discriminated unions for complex UI state instead of multiple booleans.
- Treat URL params, form data, local storage, and API data as boundary data; parse before writing to the store.

## Refactor workflow

1. Identify props passed through components only to reach descendants.
2. Decide which values are true shared UI state.
3. Create or update the nearest feature `lib/*-store.ts` file.
4. Move only data into the Zustand store.
5. Export standalone action functions below the store for writes.
6. Replace prop chains with store selectors and direct action imports.
7. Remove now-unused props and imports.

## Checks

Before finishing, verify:

- Zustand store contains data only.
- Actions are exported functions outside the store.
- Components use store selectors for reads.
- Components call no-argument actions directly where possible, like `onClick={increment}`.
- Prop drilling was actually reduced.
