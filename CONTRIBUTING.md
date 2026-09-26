# Contributing to sorostream-app

Thank you for your interest! This repo participates in the **Stellar Wave Program** on [Drips Wave](https://drips.network/wave).

## Wave Contributor Workflow

1. **Browse open issues** — pick one labelled `Stellar Wave`.
2. **Apply via Drips Wave** — do **not** begin coding until assigned by the maintainer.
3. **Fork & branch** — `feat/N-description` or `fix/N-description`.
4. **Code** — `npm run build` must pass. All layouts must be mobile responsive.
5. **PR** — title references the issue, body includes `Closes #N`.

## Local Setup

```bash
cp .env.example .env.local
# Fill in your contract ID and network

npm install
npm run dev    # http://localhost:3000
npm run build  # verify production build
npm run lint   # ESLint check
```

## Env Vars

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed StreamContract address |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_ADMIN_ADDRESSES` | Comma-separated list of admin wallet public keys for `/admin` |

## Project Structure

```
sorostream-app/
├── components/          # Reusable UI components
│   ├── ui/              # Base UI components (buttons, inputs, etc.)
│   └── __tests__/       # Component tests
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── dashboard/   # Dashboard page with stream list
│   │   ├── stream/      # Stream creation and detail pages
│   │   └── settings/    # User settings page
│   ├── components/      # Page-specific components
│   ├── context/         # React context providers (wallet, bookmarks, etc.)
│   ├── lib/             # Utility functions and business logic
│   │   └── __tests__/   # Unit tests for utilities
│   └── locales/         # i18n translation files
├── e2e/                 # Playwright end-to-end tests
└── public/              # Static assets
```

## Component Conventions

### File Naming and Organization

Follow these naming rules consistently — they make it easy to tell what kind of file you are looking at at a glance:

| File type | Convention | Example |
|-----------|-----------|---------|
| React component | PascalCase `.tsx` | `StreamCard.tsx` |
| Custom hook | camelCase `.ts` starting with `use` | `useFormPersist.ts` |
| Utility / helper | kebab-case `.ts` | `stream-utils.ts`, `balance-history.ts` |
| Context provider | PascalCase `.tsx` ending in `Context` | `WalletContext.tsx` |
| Test file | Same name as the subject with `.test.ts(x)` in `__tests__/` | `__tests__/streamHealth.test.ts` |
| Type-only file | kebab-case `.ts` | `stream-types.ts` |

**Colocation rule** — put files as close as possible to where they are used:

- Components used on a single page → `src/app/[page]/components/`
- Components shared across two or more pages → `components/`
- Hooks and utilities → `src/lib/`
- Context providers → `src/context/`

### Component Structure

Every component should follow this structure. Keep the sections in order so files are predictable to navigate:

```tsx
"use client"; // Required if the component uses hooks, event handlers, or browser APIs

import { useState, useEffect } from "react";
// External imports first, then internal imports
import { useWallet } from "@/src/context/WalletContext";

// 1. Props interface (always explicit — no `any`)
interface StreamCardProps {
  streamId: string;
  recipientAddress: string;
  amountUsdc: bigint;
  onWithdraw?: () => void;
}

// 2. Default export — named after the file
export default function StreamCard({
  streamId,
  recipientAddress,
  amountUsdc,
  onWithdraw,
}: StreamCardProps) {
  // 3. Hooks at the top
  const { address } = useWallet();
  const [isExpanded, setIsExpanded] = useState(false);

  // 4. Derived values / handlers
  const isOwner = address === recipientAddress;

  // 5. JSX
  return (
    <div className="rounded-lg bg-gray-800 p-4">
      {/* content */}
    </div>
  );
}
```

Key rules:
- Add `"use client"` at the top whenever the component uses any React hook, browser API (`window`, `document`, `localStorage`), or event handler.
- Always define a named `interface` for props — never use inline object types or `any`.
- Export the component as the default export, named identically to the file (e.g., `StreamCard` from `StreamCard.tsx`).
- Named exports are fine for sub-components or utilities within the same file, but each file should have one primary default export.

### Styling Conventions

- Use Tailwind CSS for all styling. Do not write custom CSS unless absolutely necessary.
- Follow the existing color scheme: `gray-900` background, `green-700` / `green-500` accents for primary actions, `red-600` for destructive actions.
- Mobile-first layout: all layouts must be responsive. Test at 375 px (mobile) and 1280 px (desktop) breakpoints.
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<section>`, `<article>`) rather than `<div>` for everything.
- Every interactive element must have an accessible label — use `aria-label` when the visible text is insufficient (e.g., icon-only buttons).

---

## Custom Hook Patterns

### Naming and Location

All custom hooks live in `src/lib/` and follow the `use<Feature>` naming convention — this is a hard requirement since React uses the `use` prefix to identify hooks and enforce the Rules of Hooks.

| Hook file | Purpose |
|-----------|---------|
| `useFormPersist.ts` | Persists create-stream form drafts to `sessionStorage` with debouncing |
| `useRpcHealth.ts` | Polls the active RPC endpoint every 30 s and returns health status + latency |
| `useKeyboardShortcuts.ts` | Registers global keyboard shortcut listeners from a declarative config |
| `useXlmPrice.ts` | Fetches and caches the XLM/USD price from an off-chain feed, refreshing every 5 min |
| `useOraclePrice.ts` | Reads a token's USD price from the on-chain price oracle |
| `useContractVersion.ts` | Fetches the deployed contract version and detects ABI mismatches |
| `useFocusTrap.ts` | Traps keyboard focus inside a container (for modals/dialogs) |
| `useRpcFetch.ts` | Wraps `rpcFetch` with automatic rate-limit toast notifications |

### Hook File Structure

Each hook file should be self-contained: types, any pure helper functions, and the exported hook itself all in one file. This keeps the hook easy to test and import.

```ts
"use client"; // hooks always run on the client

// 1. Types exposed in the return value
export interface FeatureState {
  value: string | null;
  loading: boolean;
}

// 2. Pure helpers (easy to unit-test independently)
function parseValue(raw: string): string | null {
  // ...
}

// 3. The hook itself — named export, use<Feature>
export function useFeature(input: string): FeatureState {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const result = parseValue(await getFeatureData(input));
      if (!cancelled) {
        setValue(result);
        setLoading(false);
      }
    }

    void fetch();

    // Always clean up: cancel async work, clear intervals, remove listeners
    return () => {
      cancelled = true;
    };
  }, [input]);

  return { value, loading };
}
```

### Key conventions

**Cancellation** — Any hook that fires an async operation must use a `cancelled` flag (see `useXlmPrice`, `useOraclePrice`) or an `AbortController` to prevent state updates on unmounted components.

**Stable callbacks** — Wrap callbacks in `useCallback` so callers can safely include them in dependency arrays without triggering infinite loops. See `useRpcHealth.checkHealth` and `useFormPersist.saveDraft` for examples.

**Debouncing** — When a hook writes to storage on every change (e.g., form fields), debounce the write using `useRef` to hold the timer handle so it is properly cancelled on unmount:

```ts
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  };
}, []);
```

**Polling** — Use `setInterval` inside `useEffect` and always return the cleanup function:

```ts
useEffect(() => {
  void checkHealth(); // run immediately
  const interval = setInterval(() => void checkHealth(), POLL_INTERVAL_MS);
  return () => clearInterval(interval);
}, [checkHealth]);
```

**Pure helpers alongside hooks** — Extract pure logic from hooks into named helper functions in the same file (e.g., `readDraft`, `writeDraft`, `clearDraft` in `useFormPersist.ts`). Pure helpers are trivial to unit-test without React harness.

**Where to add a new hook** — Add it to `src/lib/use<Feature>.ts`. If the hook depends on a context (e.g., it reads `WalletContext`), import the context inside the hook rather than accepting the context value as a prop — this keeps call-sites clean.

---

## State Management

The app uses a layered approach. Choose the right layer based on the scope and lifetime of the data:

| Layer | When to use | Examples |
|-------|-------------|---------|
| Local `useState` | UI-only state that does not need to be shared | modal open/close, form field values, loading flags |
| `useRef` | Mutable values that should not trigger re-renders | timers, previous values, animation frames |
| Context | State shared across multiple components or pages | wallet connection, user settings, notifications |
| `sessionStorage` | Form drafts that survive page refresh but not tab close | create-stream draft via `useFormPersist` |
| `localStorage` | User preferences that survive browser restarts | settings, bookmarks, notification counts |

### Context Providers

All providers live in `src/context/` and are mounted in the root layout. Here is a summary of what each one owns:

| Provider | Hook | What it manages |
|----------|------|----------------|
| `WalletProvider` | `useWallet()` | Freighter wallet connection, address, session expiry, stream refresh triggers |
| `SettingsProvider` | `useSettings()` | User preferences persisted to `localStorage`: USD display, confirmation thresholds, keyboard shortcuts, default token, theme, preferred fiat |
| `PreferencesProvider` | `usePreferences()` | Stream creation defaults persisted to `localStorage`: default token, durations, theme |
| `BookmarksProvider` | `useBookmarks()` | Per-wallet bookmarked stream IDs, stored in `localStorage` under a wallet-scoped key |
| `NotificationProvider` | `useNotifications()` | Unread badge counts per nav section, synced across tabs via the `storage` event |
| `ContractVersionProvider` | `useContractVersion()` | Deployed contract version fetched on mount, with mismatch detection |
| `RateLimitProvider` | `useRateLimit()` | Active RPC 429 backoff state broadcast from `rpcClient` |

### Context Provider Structure

Every context follows the same pattern — use this as your template when adding a new one:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// 1. Type for the value the context exposes
interface FeatureContextValue {
  data: string | null;
  setData: (value: string) => void;
}

// 2. Create the context — undefined as default so consumers can detect missing provider
const FeatureContext = createContext<FeatureContextValue | undefined>(undefined);

// 3. The provider component
export function FeatureProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<string | null>(null);

  const setData = useCallback((value: string) => {
    setDataState(value);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({ data, setData }), [data, setData]);

  return (
    <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
  );
}

// 4. The consumer hook — throws a clear error if used outside the provider
export function useFeature() {
  const ctx = useContext(FeatureContext);
  if (!ctx) throw new Error("useFeature must be used within FeatureProvider");
  return ctx;
}
```

Key rules:
- Always pass `undefined` as the default context value — this ensures the guard in the consumer hook catches missing providers at development time.
- Always wrap the context value in `useMemo` and wrap callbacks in `useCallback`. This prevents every context consumer from re-rendering when an unrelated piece of state changes.
- The provider and its consumer hook are both exported from the same file.
- Persist to `localStorage` inside the setter callbacks using a `persist()` helper function in the same file, as seen in `SettingsContext` and `BookmarksContext`.

### When to use local state vs context

Use **local `useState`** when:
- Only one component (or its direct children) needs the value
- The value is UI-only (e.g., "is this dropdown open?")
- The value does not need to survive navigation

Use **context** when:
- Two or more unrelated components need the same value
- The value represents application-level state (wallet, settings, notifications)
- The value needs to persist across page navigations within the same session

Avoid putting transient loading states or per-request data into context — keep those local to the component or hook that owns the request.

---

## Testing

The project uses **Vitest** (unit / component) and **Playwright** (end-to-end). The Vitest environment is jsdom with `globals: true`, so `describe`, `it`, `expect`, `vi`, etc. are available without an import.

```bash
# Run all unit tests once
npm run test:run

# Run in watch mode (interactive)
npm run test:ui

# Run E2E tests
npm run test:e2e

# Run E2E tests with Playwright UI
npm run test:e2e:ui
```

### Unit Tests — Utility Functions

- **Required for**: Every function in `src/lib/` that contains business logic
- **Location**: `src/lib/__tests__/<filename>.test.ts`
- **Coverage target**: 100% for the core logic paths

```ts
import { describe, it, expect } from "vitest";
import { calculateStreamRate, formatUsdc } from "../stream-utils";

describe("calculateStreamRate", () => {
  it("returns stroops-per-second for a valid input", () => {
    expect(calculateStreamRate(1_000_000n, 3600)).toBe(277n); // ~277 stroops/s
  });

  it("returns 0n when duration is zero", () => {
    expect(calculateStreamRate(1_000_000n, 0)).toBe(0n);
  });
});
```

Separate pure helpers from the hook that uses them (see `useFormPersist.ts` → `readDraft`, `writeDraft`, `clearDraft`). Test the pure helpers directly — they do not need a React harness.

### Component Tests

- **Required for**: Any component with conditional rendering, user interaction, or integration with a context
- **Location**: `components/__tests__/<ComponentName>.test.tsx` or `src/lib/__tests__/<name>.test.tsx`
- **Framework add-ons**: `@testing-library/react` + `@testing-library/jest-dom` (already configured via `src/test/setup.ts`)

Basic component test structure:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StreamCard from "../StreamCard";

describe("StreamCard", () => {
  const defaultProps = {
    streamId: "1",
    recipientAddress: "GABC123",
    amountUsdc: 1_000_000_000n,
  };

  it("renders the stream id", () => {
    render(<StreamCard {...defaultProps} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls onWithdraw when the Withdraw button is clicked", () => {
    const onWithdraw = vi.fn();
    render(<StreamCard {...defaultProps} onWithdraw={onWithdraw} />);
    fireEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it("does not render the Withdraw button when onWithdraw is not provided", () => {
    render(<StreamCard {...defaultProps} />);
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
  });
});
```

**Key testing principles:**
- Query by role (`getByRole`) and accessible label first. Fall back to `data-testid` only when there is no semantic alternative.
- Test behaviour, not implementation: assert what the user sees and can do, not internal state.
- Test the unhappy path (empty state, loading skeleton, error message) alongside the happy path.
- Use `screen.queryBy*` (returns `null`) when asserting an element is absent; use `screen.getBy*` (throws) when asserting it is present.

### Testing Components That Use Context

Wrap the component in the relevant provider(s). Create a small helper per test file to avoid repeating boilerplate:

```tsx
import { render } from "@testing-library/react";
import { WalletProvider } from "@/src/context/WalletContext";
import { SettingsProvider } from "@/src/context/SettingsContext";
import type { ReactNode } from "react";

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </WalletProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: AllProviders });
}
```

When testing a context provider itself, render a minimal consumer component that exposes the values via `data-testid` or `screen.getByText`. See `src/context/__tests__/WalletContext.test.tsx` for the full pattern.

### Mock Patterns

**Mocking modules** — Use `vi.mock` at the top of the test file. For modules that have a mix of real and mocked exports, use the async `importOriginal` form to spread the real exports and override only what you need:

```ts
vi.mock("@/src/lib/sorostream", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/src/lib/sorostream")>();
  return {
    ...original,
    // Override only what the test needs to control
    getStreamEvents: vi.fn(() => []),
  };
});
```

**Mocking Next.js internals** — The following stubs are pre-configured in `vitest.config.ts` and available automatically in every test:

| Import | Stub location |
|--------|--------------|
| `next/link` | `src/test/mocks/next-link.tsx` |
| `next/image` | `src/test/mocks/next-image.tsx` |
| `next/navigation` | `src/test/mocks/next-navigation.ts` |

The `next/navigation` stub exposes `useRouter`, `usePathname`, `useSearchParams`, and `useParams` as `vi.fn()` instances. Override them per-test when navigation behaviour matters:

```ts
import { useRouter } from "next/navigation";

(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  refresh: vi.fn(),
});
```

**Mocking `localStorage` / `sessionStorage`** — jsdom provides in-memory implementations that work out of the box. Call `localStorage.clear()` in `beforeEach` to prevent test pollution:

```ts
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
```

**Faking timers** — Use `vi.useFakeTimers()` / `vi.useRealTimers()` for hooks that rely on `setInterval`, `setTimeout`, or `Date.now()`. Always restore real timers in `afterEach`:

```ts
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("auto-dismisses after 4 seconds", () => {
  // ... render
  act(() => { vi.advanceTimersByTime(4000); });
  expect(screen.queryByText("bye")).not.toBeInTheDocument();
});
```

**Mock data** — Keep synthetic data in `src/test/` helpers (e.g., `src/test/balanceHistoryTestHelpers.ts`). Do not export mock/test data from production `src/lib/` modules — this keeps production bundles lean and prevents synthetic data from reaching users.

### End-to-End Tests

- **Required for**: New user flows and critical paths (create stream, withdraw, settings change)
- **Framework**: Playwright
- **Location**: `e2e/`

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
```

**Visual regression** — The create-stream dark-mode snapshot is tracked in `e2e/`. When you intentionally change the styling of the create-stream form, regenerate the baseline:

```bash
npx playwright test e2e/visual-regression.spec.ts --update-snapshots
```

Include the updated `.png` snapshot file in your PR along with a brief explanation of why the visual change was intentional.

### Test Coverage Requirements

| Target | Expectation |
|--------|-------------|
| Utility functions (`src/lib/`) | 100% coverage for core logic branches |
| Context providers | Happy path + missing-provider guard (throws correct error) |
| Components | Critical render paths, user interactions, empty/loading/error states |
| New features | At least one E2E test covering the main user flow |
| Visual changes | Dark-mode snapshot baseline reviewed and updated when intentional |

## Contributing Translations (i18n)

We support multi-language (i18n) localization to make SoroStream accessible to communities around the world.

### 1. Translation File Location & Key Format

All translation keys are stored as JSON files under [src/locales/](file:///Users/marvellous/Desktop/sorostream-app-1/src/locales/).

Keys follow a nested JSON structure that maps to a **`namespace.element`** pattern:
- **Namespaces**: The top-level keys in the JSON objects represent namespaces corresponding to pages or feature areas (e.g. `dashboard`, `settings`, `stream_new`, `stream_detail`, `wallet`).
- **Elements**: Under each namespace, the leaf nodes represent specific text string keys, named using `snake_case` (e.g., `hero_title`, `no_streams`).
- **Placeholders**: Dynamic variables in translation strings are enclosed in curly braces (e.g., `{wallet}`, `{count}`).

### 2. How to Add a New Locale (Worked Example)

Here is a step-by-step worked example of adding support for French (`fr`):

#### Step A: Create the JSON Translation File
Create a new file at `src/locales/fr.json` using `src/locales/en.json` as a base reference. Make sure all namespaces and keys match exactly:
```json
{
  "dashboard": {
    "title": "Tableau de bord",
    "no_streams": "Aucun flux disponible."
  },
  "wallet": {
    "connect": "Connecter {wallet}"
  }
}
```

#### Step B: Register the Translation File in the App Code
Update [src/lib/i18n.ts](file:///Users/marvellous/Desktop/sorostream-app-1/src/lib/i18n.ts) to import the new JSON locale file and add it to the `translations` registry mapping:
```ts
import en from "../locales/en.json";
import pt from "../locales/pt.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json"; // 1. Import new locale file

const translations: Record<string, typeof en> = {
  en,
  pt,
  es,
  fr, // 2. Register new mapping
};
```

#### Step C: Expose the Locale in User Settings
Open [src/app/settings/page.tsx](file:///Users/marvellous/Desktop/sorostream-app-1/src/app/settings/page.tsx) and add the new language option inside the selector component:
```tsx
<select
  value={language}
  onChange={(e) => setLanguage(e.target.value)}
  className="..."
>
  <option value="en">English</option>
  <option value="es">Español</option>
  <option value="pt">Português</option>
  <option value="fr">Français</option> {/* Register option */}
</select>
```

### 3. How to Test and Preview in Development

1. **Verify key alignment**: Run the translation validation command:
   ```bash
   npm run lint
   ```
   Or run the standalone validation script:
   ```bash
   node scripts/check-i18n.mjs
   ```
   This script compares all locale files against `en.json` to ensure there are no missing or extra keys. If a key is missing, it will output validation errors.
2. **Visual testing**: Launch the app locally (`npm run dev`), go to the **Settings** page, select the new language from the dropdown, save settings, and navigate around to preview the translated pages in the browser.

### 4. Review Process for Translation PRs

All submitted translation contributions go through the following review process:
1. **Automated Key Validation Check**: Continuous Integration (CI) runs `npm run lint` automatically. Any missing or extraneous keys will fail the build.
2. **Review & Proofreading**: Maintainers or native speakers in the community will review translations for style, correctness, and natural phrasing.
3. **No Placeholders Altered**: Reviewers will ensure that placeholders (e.g. `{wallet}`) are kept intact and are not translated or deleted.


## PR Checklist

Before submitting your PR, ensure:

- [ ] Code follows the project structure and naming conventions
- [ ] All tests pass (`npm run test` and `npm run test:e2e`)
- [ ] Build succeeds (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Components are mobile-responsive
- [ ] Accessibility requirements are met (ARIA labels, keyboard navigation)
- [ ] Translation keys are added/updated if UI text changed
- [ ] If the create-stream form changed, the dark-mode visual baseline was reviewed and updated intentionally

## How to Add a New SAC Token to the Token Selector Dropdown

When you need to support a new Stellar Asset Contract (SAC) token in the app's
create-stream form, you must update the token registry and several surrounding
files.  This section lists every touchpoint so nothing gets missed.

### Files That Must Be Updated

| # | File | What to change |
|---|------|----------------|
| 1 | `src/app/stream/new/page.tsx` | Add the token to the `SUPPORTED_TOKENS` array |
| 2 | `src/app/settings/page.tsx` | Add a `<option>` for the default-token dropdown |
| 3 | `src/lib/sorostream.ts` (optional) | Add the token to `MOCK_CONTRACT_STATE.whitelistedTokens` for admin-area testing |
| 4 | `src/lib/streamTemplates.ts` (optional) | Add stream templates that use the new token |
| 5 | `src/locales/en.json` (optional) | If the token name appears in user-facing text, add a translation key |

### Worked Example — Adding `EURC`

#### Step 1 – Register the token

Open `src/app/stream/new/page.tsx` and locate the `SUPPORTED_TOKENS` array
(around line 35).  Append a new entry:

```ts
const SUPPORTED_TOKENS = [
  { symbol: "USDC", name: "USD Coin",        address: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU" },
  { symbol: "XLM",  name: "Stellar Lumens",  address: "native" },
  { symbol: "AQUA", name: "Aquarius",        address: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA" },
  { symbol: "yXLM", name: "Yield XLM",       address: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55" },
  // 👇 Add the new token here
  { symbol: "EURC", name: "Euro Coin",       address: "CCW67SZVBUIC7FNJPZXNBGRAV3HMPF4Y7XYE44CUMVHWKRSOGF4RDOIV" },
] as const;
```

Each entry requires:
- **`symbol`** — ticker shown in the dropdown and throughout the UI (e.g. `EURC`)
- **`name`** — human-readable token name (e.g. `Euro Coin`)
- **`address`** — Stellar contract address of the SAC token (use `"native"` for XLM)

#### Step 2 – Expose in Settings

Open `src/app/settings/page.tsx`, find the `<select>` for the default token
(around line 275), and add a new `<option>`:

```tsx
<option value="EURC">EURC (Euro Coin)</option>
```

This lets users set the new token as their default for the create-stream form.

#### Step 3 – Add to token whitelist (Admin area)

If the token should appear in the admin panel's whitelist for testing, open
`src/lib/sorostream.ts`, find `MOCK_CONTRACT_STATE.whitelistedTokens`, and add
the symbol:

```ts
whitelistedTokens: ["USDC", "XLM", "AQUA", "EURC"],
```

#### Step 4 – Verify

1. Run `npm run build` — the build must pass.
2. Run `npm run lint` — no new lint violations.
3. Start the dev server (`npm run dev`), open `/stream/new`, and confirm the
   new token appears in the dropdown.
4. Create a stream with the new token and verify the stream detail page shows
   the correct token symbol.

### Important Notes

- **No icon asset needed** — the dropdown uses text-only option labels; icons
  are not rendered for individual tokens.
- **The token address should be the Stellar Asset Contract address**, not the
  classic asset issuer.
- On testnet, make sure the token has been deployed before adding it.
- After adding a token here, run the Playwright E2E tests to verify the
  create-stream flow still works: `npm run test:e2e`.

## Getting Help

- Check existing issues for similar problems
- Review the codebase for examples of similar implementations
- Ask questions in the PR description if something is unclear
