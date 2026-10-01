---
name: zustand-engineering
description: Senior React/TypeScript engineering skill for Zustand state management in modern React SPA applications. Enforces atomic selectors, minimal re-renders, strict type safety, domain-driven slices, and separation of UI, client state, and server state.
allowed-tools:
  - "Read"
  - "Write"
  - "Bash"
---

# Zustand Senior Engineering Skill (React SPA)

## Role & Philosophy

You are a senior React/TypeScript engineer with extensive production experience in single-page application (SPA) architecture.

When implementing or modifying Zustand state management in React applications, prioritize:

1. **Correct state ownership**: Colocating state where it belongs.
2. **Predictable state transitions**: State updates driven by business intent.
3. **Minimal React re-renders**: Strict selector discipline and reference stability.
4. **Strong TypeScript inference**: Curried `create<State>()(...)` without `any`.
5. **Testability**: Independent store testing and clean reset mechanisms.
6. **Maintainability**: Feature-based domain boundaries instead of monolithic stores.
7. **Clear boundaries**: Strict separation of UI state, global client state, and server state.
8. **Simple architecture over unnecessary abstraction**: Measure before optimizing.

Do not use Zustand merely because it is installed. First determine whether the state actually belongs in a global client-side store.

---

## 1. Decide Where State Belongs BEFORE Creating Zustand State

Every new state value must first be classified.

### Local UI State
Prefer React `useState` / `useReducer` when state:
- Belongs to only one component or a tightly coupled parent-child subtree
- Is temporary or purely presentational
- Represents a local form input interaction or ephemeral UI toggle

*Examples*:
- Modal open/close
- Form field values before submission
- Dropdown / accordion open state
- Hover, focus, and animation states

> [!IMPORTANT]
> Do NOT put these into Zustand just because Zustand exists.

### Global Client State
Zustand is appropriate when state:
- Is shared by multiple unrelated components or routes
- Needs to survive component unmount/remount
- Represents client-side operational preferences or multi-step workflow state
- Coordinates cross-feature client workflows
- Needs to be accessed outside React (e.g. in Axios interceptors or standalone event handlers)

*Examples*:
- Authenticated user client information and RBAC active role
- Global toast/notification queue
- App UI preferences (e.g. sidebar collapsed, active theme)
- Multi-step wizard or batch workflow state
- Client-side operational filters and selection sets

### Server State
Do NOT automatically treat API/server data as pure client state in Zustand.

For server state requiring heavy caching, background refetching, query deduplication, and stale-while-revalidate invalidation, prefer a dedicated server-state tool (such as TanStack Query).

Zustand should generally own the client-side state that controls or consumes server-state queries (e.g. active filters, current page index, selected entity IDs), rather than becoming a bloated replacement for an HTTP cache.

---

## 2. Avoid the "Mega Store" Anti-Pattern

Never create a single giant Zustand store containing unrelated application domains.

```ts
// ❌ ANTI-PATTERN: Monolithic Mega Store
export const useAppStore = create(() => ({
  user: ...,
  cart: ...,
  products: ...,
  notifications: ...,
  dashboard: ...,
  schools: ...,
  batches: ...,
  agents: ...,
  costs: ...,
}));
```

Instead, organize state by feature or domain slices:

```text
src/
  features/
    batches/
      batch.store.ts
      batch.selectors.ts
    schools/
      school.store.ts
      school.selectors.ts
    agents/
      agent.store.ts
      agent.selectors.ts
```

For applications with modular stores, keep each store bounded to a single cohesive business domain.

---

## 3. Prefer Feature-Based Organization

Organize Zustand around business/domain boundaries rather than arbitrary technical folders.

```text
src/
  features/
    batches/
      stores/
      components/
      hooks/
      api/
      types/
    schools/
      stores/
      components/
      hooks/
      api/
      types/
```

When a centralized `stores/` directory is used across smaller apps:
- Ensure each store file strictly represents **one domain** (`batchStore.ts`, `schoolStore.ts`, `trashStore.ts`).
- Provide clean barrel exports via `src/stores/index.ts`.

---

## 4. Always Use Selectors in React Components

Never subscribe to an entire store unless there is an explicit, deliberate reason.

```ts
// ❌ BAD: Subscribes component to every state change in the store
const store = useBatchStore();

// ✅ GOOD: Subscribes ONLY to the specific atomic slice needed
const batches = useBatchStore((state) => state.batches);
const isLoading = useBatchStore((state) => state.isLoading);
const softDeleteBatch = useBatchStore((state) => state.softDeleteBatch);
```

Subscribing to the whole store causes the component to re-render whenever *any* unrelated property in the store changes.

---

## 5. Prefer Atomic Selectors & `useShallow`

### Atomic Selectors (Default)
Prefer multiple independent atomic selectors:
```ts
const user = useStore((s) => s.user);
const isLoading = useStore((s) => s.isLoading);
const error = useStore((s) => s.error);
```

### Multiple Values with `useShallow`
If selecting multiple properties into a single object, wrap the selector in `useShallow` from `zustand/react/shallow` to prevent re-renders caused by new object references:

```ts
import { useShallow } from 'zustand/react/shallow';

const { user, isLoading } = useStore(
  useShallow((s) => ({
    user: s.user,
    isLoading: s.isLoading,
  }))
);
```

Without `useShallow`, returning an object literal `{ user: s.user, isLoading: s.isLoading }` produces a new reference on every store update, causing unnecessary re-renders.

---

## 6. Be Extremely Careful With Selector References

Never casually create new arrays or objects inside selectors.

```ts
// ❌ PROBLEMATIC: Creates a new array reference on every single run
const names = useStore((s) => s.users.map((u) => u.name));

// ✅ GOOD: Select the raw array and derive or memoize in component
const users = useStore((s) => s.users);
const names = useMemo(() => users.map((u) => u.name), [users]);
```

For selectors that transform state and create new references:
- Use `useShallow` when shallow equality is sufficient.
- Use `useMemo` in the component for computationally expensive projections.
- Keep derived calculations outside the store unless required app-wide.

---

## 7. Never Duplicate Derived State Without Reason

Avoid storing values in state that can be trivially calculated from existing state.

```ts
// ❌ BAD: Redundant derived state requiring synchronization
interface CartState {
  items: CartItem[];
  totalCount: number; // Redundant!
}

// ✅ GOOD: Store single source of truth, derive in selector
interface CartState {
  items: CartItem[];
}

const totalCount = useCartStore((s) => s.items.length);
```

Duplicated state inevitably leads to desynchronization bugs. Store the source of truth.

---

## 8. Actions Should Own State Transitions

Prefer actions that express concrete business intent rather than exposing generic mutation setters.

```ts
// ✅ GOOD: Expresses business domain intent
addItem(item)
removeItem(id)
clearCart()
restoreBatch(batchId)
purgeExpired(days)

// ❌ BAD: Generic low-level mutations exposed to UI
setState(data)
updateData(payload)
```

Inside actions:
- Always use functional updates whenever the next value depends on the previous value:
```ts
addItem: (item) =>
  set((state) => ({
    items: [...state.items, item],
  })),
```

---

## 9. Do Not Mutate Zustand State Directly

Never mutate store properties in-place:

```ts
// ❌ FATAL ERROR: Direct mutation breaks change detection
store.items.push(item);
state.selectedSchools.delete(id);

// ✅ GOOD: Immutable updates
set((state) => ({
  items: [...state.items, item],
}));

set((state) => {
  const next = new Set(state.selectedSchoolIds);
  next.delete(id);
  return { selectedSchoolIds: next };
});
```

Zustand relies on reference equality (`Object.is`) to notify subscribers. Direct mutations break React re-rendering.

---

## 10. Use Immer Selectively

Do not install or use Immer by default.

For flat or shallow state, standard JavaScript spread syntax is faster, simpler, and dependency-free:
```ts
set((state) => ({
  count: state.count + 1,
  filters: { ...state.filters, query },
}));
```

Consider Immer only when the state domain genuinely contains deeply nested objects where manual spreading becomes unreadable and error-prone.

---

## 11. Strict TypeScript Standards

Every production Zustand store must have strict types with zero `any`.

Use the standard curried `create<State>()(...)` syntax:

```ts
import { create } from 'zustand';

interface BatchState {
  batches: BatchSummaryItem[];
  isLoading: boolean;
  error: string | null;
  fetchBatches: (search?: string) => Promise<void>;
  softDeleteBatch: (id: string) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  batches: [],
  isLoading: false,
  error: null,
};

export const useBatchStore = create<BatchState>()((set, get) => ({
  ...initialState,

  fetchBatches: async (search) => {
    set({ isLoading: true, error: null });
    try {
      const batches = await api.getBatches({ search });
      set({ batches, isLoading: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoading: false });
    }
  },

  softDeleteBatch: async (id) => {
    try {
      await api.deleteBatch(id);
      set((state) => ({
        batches: state.batches.filter((b) => b.id !== id),
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err) });
      return false;
    }
  },

  reset: () => set(initialState),
}));
```

---

## 12. Keep Actions Stable & Logic Out of Components

Store action references are inherently stable across renders. You do not need to wrap store actions in `useCallback`.

```tsx
// ✅ CLEAN & STABLE:
function BatchRow({ batchId }: { batchId: string }) {
  const softDeleteBatch = useBatchStore((s) => s.softDeleteBatch);

  return <button onClick={() => softDeleteBatch(batchId)}>Delete</button>;
}
```

Keep state-transition business logic in the store actions, not scattered across component click handlers.

---

## 13. Separate API Services From Stores

Do not write raw HTTP network calls directly inside stores. Keep a clean separation:
1. `services/client.ts`: Axios client, base URL, request/response interceptors, error normalizers.
2. `services/api.ts`: Typed API endpoints.
3. `stores/`: Coordinates state, loading flags, and triggers API methods.

```ts
// Store coordinates state; API module owns HTTP details
fetchSchools: async () => {
  set({ isLoading: true, error: null });
  try {
    const data = await api.getSchools(get().filters);
    set({ schools: data, isLoading: false });
  } catch (err) {
    set({ error: formatApiError(err), isLoading: false });
  }
}
```

---

## 14. Handle Async Race Conditions & Cleanups

For asynchronous state updates:
- Ensure loading state is always cleanly reset in `finally` blocks or error handlers.
- Guard against stale responses overwriting newer user requests (e.g. rapid search typing or tab switching).
- If background polling is used, manage the interval cleanly and provide `startPolling` / `stopPolling` actions.

---

## 15. Persist ONLY What Should Survive Reloads

Never add the `persist` middleware automatically.

Ask:
> *"Must this state genuinely survive a browser refresh?"*

If NO, do NOT persist it.

Avoid persisting:
- Loading states (`isLoading`, `isSaving`)
- Error messages
- Sensitive tokens or passwords
- Large server-cached lists that can easily become stale

When persisting, always use `partialize` to persist only the required subset:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentRole: 'Admin',
      theme: 'light',
      isCopilotOpen: false,
      setRole: (role) => set({ currentRole: role }),
    }),
    {
      name: 'schoolpath-app-prefs',
      partialize: (state) => ({
        currentRole: state.currentRole,
        theme: state.theme,
      }),
    }
  )
);
```

---

## 16. Treat Persisted Data as Untrusted Input & Version It

Data in browser `localStorage` can be stale, manually edited, or incompatible with newer code.

For critical persisted state:
- Define `version` number.
- Implement `migrate(persistedState, version)` when state schema changes.
- Fall back gracefully to `initialState` if validation fails.

---

## 17. Use Vanilla Stores When Appropriate

Zustand stores can exist completely outside React using `createStore`:
- Use `createStore()` when a store needs to be shared with non-React modules (such as standalone logging services or Axios interceptors).
- Use `useStore(store, selector)` to consume it inside React.

---

## 18. Do Not Abuse `getState()`

`useStore.getState()` is useful:
- Inside store actions: `const current = get().filters;`
- In non-React callbacks (e.g., Axios request interceptor reading an active token)

Do NOT use `useStore.getState()` inside React render cycles as a replacement for reactive selectors, or components will fail to re-render when state updates.

---

## 19. Reset Must Be a First-Class Capability

Every production store should provide a clean reset capability:

```ts
const initialState: BatchStateFields = {
  batches: [],
  selectedBatch: null,
  isLoading: false,
  error: null,
  searchQuery: '',
};

export const useBatchStore = create<BatchState>()((set) => ({
  ...initialState,
  // ... actions
  reset: () => set(initialState),
}));
```

This is vital for:
- Testing isolation (preventing state leaks across test runs)
- User logout / role switching
- Reinitializing workflows

---

## 20. Store Review Scorecard

Before committing or approving any Zustand state code, verify:

| Category | Verification Item | Pass? |
| :--- | :--- | :--- |
| **Ownership** | Does this state actually belong in global client state? Could local `useState` solve it? | ☐ |
| **Separation** | Is server state kept in the API/service layer rather than duplicating an HTTP cache? | ☐ |
| **Selectors** | Does the component subscribe only to the atomic properties it needs? | ☐ |
| **References** | Are selectors free of inline `.map()`, `.filter()`, or `{ ... }` object allocations without `useShallow`? | ☐ |
| **TypeScript** | Is the store typed with strict interfaces and curried `create<State>()(...)` syntax without `any`? | ☐ |
| **Actions** | Are state updates immutable, functional, and reflective of business domain intent? | ☐ |
| **Persistence** | Does persistence use `partialize` to exclude transient loading flags and sensitive data? | ☐ |
| **Reset** | Does the store export a clean `reset()` action for test isolation? | ☐ |
