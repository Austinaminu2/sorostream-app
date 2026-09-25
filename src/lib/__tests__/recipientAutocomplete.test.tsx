/**
 * Unit tests for RecipientAutocomplete — debounce & AbortController (issue #579).
 *
 * Acceptance criteria from the issue:
 *   ✓ Lookup is debounced 300 ms after the last keystroke
 *   ✓ In-flight requests from previous keystrokes are cancelled (AbortController)
 *   ✓ Typing 5 characters in rapid succession fires only 1 lookup
 *
 * Additional coverage:
 *   - Non-federation input (no "*") never triggers a lookup at all
 *   - Debounce timer resets on every keystroke, not just the first
 *   - UI shows resolving spinner immediately on "*" input, before debounce fires
 *   - UI shows "Federation resolved" banner on success
 *   - UI shows "Resolution failed" banner when lookup returns null
 *   - Stale result from an aborted request does not overwrite a later result
 */

import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import RecipientAutocomplete from "@/components/RecipientAutocomplete";

// ---------------------------------------------------------------------------
// Module-level mocks  (vi.mock calls are hoisted to top of file by Vitest)
// ---------------------------------------------------------------------------

// No contacts needed — keeps tests focused on the federation lookup path.
vi.mock("@/src/lib/addressBook", () => ({
  getContacts: () => [],
}));

// We own the federation mock so we can control resolution timing.
const mockResolveFederationName = vi.fn<[string], Promise<string | null>>();
vi.mock("@/src/lib/federation", () => ({
  resolveFederationName: (addr: string) => mockResolveFederationName(addr),
}));

// ---------------------------------------------------------------------------
// Fake-timer lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  // Default: instantly resolves to a valid G-address
  mockResolveFederationName.mockResolvedValue(
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Controlled render helper
// Keeps the `value` prop in sync with `onChange` so effects re-run correctly.
// ---------------------------------------------------------------------------

interface ControlledProps {
  value: string;
  onChange: ReturnType<typeof vi.fn>;
  onBlur: ReturnType<typeof vi.fn>;
  placeholder: string;
}

function renderComponent(initialValue = "") {
  // We need a mutable reference so the closure inside `onChange` always sees
  // the latest props object.
  const currentProps: ControlledProps = {
    value: initialValue,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    placeholder: "Recipient address",
  };

  const { rerender: baseRerender, unmount } = render(
    <RecipientAutocomplete {...currentProps} />,
  );

  function rerender(nextValue: string) {
    currentProps.value = nextValue;
    baseRerender(<RecipientAutocomplete {...currentProps} />);
  }

  return { rerender, unmount, onChange: currentProps.onChange };
}

// ---------------------------------------------------------------------------
// Suite 1 — debounce timing
// ---------------------------------------------------------------------------

describe("RecipientAutocomplete — 300 ms debounce (issue #579)", () => {
  it("does NOT call resolveFederationName for plain G-address input", () => {
    renderComponent("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7");

    act(() => { vi.advanceTimersByTime(1_000); });

    expect(mockResolveFederationName).not.toHaveBeenCalled();
  });

  it("does NOT fire immediately when the first '*' keystroke arrives", () => {
    const { rerender } = renderComponent("");

    rerender("a*stellar.org");
    // Only 100 ms — still inside the debounce window
    act(() => { vi.advanceTimersByTime(100); });

    expect(mockResolveFederationName).not.toHaveBeenCalled();
  });

  it("fires exactly once after 300 ms of silence", async () => {
    const { rerender } = renderComponent("");

    rerender("alice*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(mockResolveFederationName).toHaveBeenCalledTimes(1);
      expect(mockResolveFederationName).toHaveBeenCalledWith("alice*stellar.org");
    });
  });

  it("fires only 1 lookup when 5 characters are typed in rapid succession", async () => {
    const { rerender } = renderComponent("");

    // Five keystrokes, each 50 ms apart — all inside the 300 ms window.
    const keystrokes = ["a*", "al*", "ali*", "alic*", "alice*stellar.org"];
    for (const v of keystrokes) {
      rerender(v);
      act(() => { vi.advanceTimersByTime(50); });
    }

    // 250 ms elapsed total — no call yet.
    expect(mockResolveFederationName).not.toHaveBeenCalled();

    // Let the debounce window expire after the last keystroke.
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(mockResolveFederationName).toHaveBeenCalledTimes(1);
      expect(mockResolveFederationName).toHaveBeenCalledWith("alice*stellar.org");
    });
  });

  it("resets the 300 ms window on every new keystroke", async () => {
    const { rerender } = renderComponent("");

    rerender("ali*stellar.org");
    // 250 ms — approaching the window but not past it
    act(() => { vi.advanceTimersByTime(250); });
    expect(mockResolveFederationName).not.toHaveBeenCalled();

    // Another keystroke resets the timer
    rerender("alic*stellar.org");
    act(() => { vi.advanceTimersByTime(250); });
    // Still only 250 ms since the *last* keystroke — no call yet
    expect(mockResolveFederationName).not.toHaveBeenCalled();

    // Now let it expire
    act(() => { vi.advanceTimersByTime(60); });

    await waitFor(() => {
      expect(mockResolveFederationName).toHaveBeenCalledTimes(1);
      expect(mockResolveFederationName).toHaveBeenCalledWith("alic*stellar.org");
    });
  });

  it("clears pending timer and does not call lookup on unmount", () => {
    const { rerender, unmount } = renderComponent("");

    rerender("alice*stellar.org");
    // Unmount before the 300 ms window closes
    act(() => { vi.advanceTimersByTime(100); });
    unmount();
    // Advance past the window — should still be zero calls
    act(() => { vi.advanceTimersByTime(500); });

    expect(mockResolveFederationName).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — UI feedback states
// ---------------------------------------------------------------------------

describe("RecipientAutocomplete — UI feedback states", () => {
  it("shows the resolving spinner as soon as '*' appears (before debounce fires)", () => {
    const { rerender } = renderComponent("");

    rerender("alice*stellar.org");
    // Immediately — no timer advance needed
    expect(screen.getByText(/resolving federation address/i)).toBeInTheDocument();
  });

  it("shows 'Federation resolved' banner after a successful lookup", async () => {
    const { rerender } = renderComponent("");

    rerender("alice*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(screen.getByText(/federation resolved/i)).toBeInTheDocument();
    });
    // The resolved G-address should also be visible inside the banner
    expect(
      screen.getByText(/GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN/i),
    ).toBeInTheDocument();
  });

  it("shows 'Resolution failed' banner when lookup returns null", async () => {
    mockResolveFederationName.mockResolvedValue(null);
    const { rerender } = renderComponent("");

    rerender("nobody*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(screen.getByText(/resolution failed/i)).toBeInTheDocument();
      expect(screen.getByText(/federation address not found/i)).toBeInTheDocument();
    });
  });

  it("shows 'Resolution failed' banner when lookup throws an error", async () => {
    mockResolveFederationName.mockRejectedValue(new Error("TOML fetch timeout"));
    const { rerender } = renderComponent("");

    rerender("bad*domain.xyz");
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(screen.getByText(/resolution failed/i)).toBeInTheDocument();
      expect(screen.getByText(/TOML fetch timeout/i)).toBeInTheDocument();
    });
  });

  it("clears federation UI when input is changed to a plain address (no '*')", async () => {
    const { rerender } = renderComponent("");

    // First trigger a successful resolution
    rerender("alice*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });
    await waitFor(() => {
      expect(screen.getByText(/federation resolved/i)).toBeInTheDocument();
    });

    // Now switch back to a plain G-address — UI should reset
    rerender("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");
    expect(screen.queryByText(/federation resolved/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resolving federation/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — AbortController: stale result cancellation
// ---------------------------------------------------------------------------

describe("RecipientAutocomplete — AbortController cancellation (issue #579)", () => {
  it("discards a stale result that arrives after a second keystroke", async () => {
    // The first lookup hangs until we manually resolve it.
    let resolveFirst!: (v: string | null) => void;
    mockResolveFederationName
      .mockImplementationOnce(
        () => new Promise<string | null>((res) => { resolveFirst = res; }),
      )
      // Second call resolves immediately
      .mockResolvedValueOnce("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");

    const { rerender } = renderComponent("");

    // First keystroke + debounce fires the first lookup
    rerender("ali*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockResolveFederationName).toHaveBeenCalledTimes(1);

    // Second keystroke while first is still in-flight — aborts it & starts a new one
    rerender("alic*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(mockResolveFederationName).toHaveBeenCalledTimes(2);
      expect(mockResolveFederationName).toHaveBeenLastCalledWith("alic*stellar.org");
    });

    // Now the second lookup has resolved → "Federation resolved" is shown
    await waitFor(() => {
      expect(screen.getByText(/federation resolved/i)).toBeInTheDocument();
    });

    // Finally resolve the stale first request — it must NOT overwrite the UI
    // because its AbortController was aborted before our setState ran.
    act(() => {
      resolveFirst("GSTALE_SHOULD_NEVER_APPEAR_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    });

    // UI is still "resolved" — not re-entered "resolved" with the stale address
    await waitFor(() => {
      expect(screen.getByText(/federation resolved/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/GSTALE_SHOULD_NEVER_APPEAR/i),
    ).not.toBeInTheDocument();
  });

  it("aborts in-flight lookup when input loses '*' before it resolves", async () => {
    let resolveHanging!: (v: string | null) => void;
    mockResolveFederationName.mockImplementationOnce(
      () => new Promise<string | null>((res) => { resolveHanging = res; }),
    );

    const { rerender } = renderComponent("");

    rerender("alice*stellar.org");
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockResolveFederationName).toHaveBeenCalledTimes(1);

    // User clears the federation address
    rerender("GAAZI4TCR3");

    // Now resolve the hanging lookup — its result must be discarded
    act(() => {
      resolveHanging("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");
    });

    await waitFor(() => {
      // Federation UI should be gone since the input no longer has '*'
      expect(screen.queryByText(/federation resolved/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/resolving federation/i)).not.toBeInTheDocument();
    });
  });
});
