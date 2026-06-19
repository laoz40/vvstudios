# Zustand modal host

Use when moving local modal open state into a feature-scoped Zustand store and rendering modal variants from one host component.

## Pattern

- Store uses a discriminated union: `{ modal: "none" } | { modal: "x"; ...payload }`.
- Store contains data only: no components, callbacks, promises, refs, or mutation functions.
- Export `openXModal(...)` actions and one close/reset action outside the store.
- Mount one host near the feature/page owner.
- Host reads the full modal state when variants have payload data.
- Host renders with an exhaustive `switch (state.modal)` and `never` default.

```ts
type ModalState =
  | { modal: "none" }
  | { modal: "details"; id: string }
  | { modal: "confirm"; message: string };

const initialState: ModalState = { modal: "none" };
export const useModalStore = create<ModalState>(() => initialState);

export const closeModal = () => useModalStore.setState(initialState);
export const openDetailsModal = (id: string) =>
  useModalStore.setState({ modal: "details", id });
```

```tsx
export function ModalHost() {
  const state = useModalStore((value) => value);

  switch (state.modal) {
    case "none":
      return null;
    case "details":
      return <DetailsModal id={state.id} onClose={closeModal} />;
    case "confirm":
      return <ConfirmModal message={state.message} onClose={closeModal} />;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
```

## Component extraction

- Prefer defining large or complex modal UIs in separate component files, then render them from the host.
- Keep simple text-only modals inline in the host when extraction would add noise.

## Boundaries

- Keep behavior-owning state outside the modal store when it is not modal state, such as submit loading, refs, external cleanup, or API calls.
- If closing needs side effects, close/reset the modal first, then run cleanup from a callback or hook outside Zustand.
- Prefer one host per feature over one giant app-wide modal host.
