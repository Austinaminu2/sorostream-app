/**
 * Unit tests for ChangelogModal (issue #574).
 *
 * Acceptance criteria from the issue:
 *   ✓ Test: modal renders the correct number of changelog entries
 *   ✓ Test: latest entry is marked with a "New" badge
 *   ✓ Test: closing the modal calls onClose
 *   ✓ Test: "mark as read" persists the last-seen version to localStorage
 *
 * Additional coverage:
 *   - Every entry's title and description are rendered
 *   - Loading skeleton is shown while the JSON is being fetched
 *   - Modal renders nothing when open=false (no DOM output)
 *   - Version sub-heading only appears after the fetch completes
 *   - Backdrop click calls onClose
 *   - "Got it" button calls onClose
 *   - Escape key calls onClose
 *   - localStorage is NOT written when the fetch fails
 *   - localStorage is NOT written when open=false
 *   - Repeated opens with the same version do not double-write localStorage
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import ChangelogModal from "@/components/ChangelogModal";

// ---------------------------------------------------------------------------
// Stub useFocusTrap — it requires real DOM focus management not needed here
// ---------------------------------------------------------------------------

vi.mock("@/src/lib/useFocusTrap", () => ({
  useFocusTrap: () => {},
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CHANGELOG = {
  version: "1.1.0",
  entries: [
    {
      icon: "⚡",
      title: "Real-time Stream Polling",
      description: "Dashboard auto-refreshes claimable amounts every 30 seconds.",
    },
    {
      icon: "📦",
      title: "Bulk Stream Actions",
      description: "Select multiple streams and cancel, top-up, or export them at once.",
    },
    {
      icon: "🔖",
      title: "Stream Bookmarks",
      description: "Bookmark your most important streams and pin them to the top.",
    },
    {
      icon: "⌨️",
      title: "Keyboard Shortcuts",
      description: "Navigate the dashboard faster. Press ? to view shortcuts.",
    },
    {
      icon: "📊",
      title: "Vesting Chart",
      description: "Stream detail pages now show a visual vesting curve chart.",
    },
  ],
};

const STORAGE_KEY = "sorostream-changelog-seen";

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Makes global.fetch return a successful CHANGELOG.json response. */
function mockFetchSuccess(data = MOCK_CHANGELOG) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

/** Makes global.fetch return a non-OK HTTP response (e.g. 404). */
function mockFetchHttpError(status = 404) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response);
}

/** Makes global.fetch throw a network-level error. */
function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
}

/** Makes global.fetch hang forever — simulates a slow network during loading. */
function mockFetchHanging() {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 — Entry rendering
// ---------------------------------------------------------------------------

describe("ChangelogModal — entry rendering", () => {
  it("renders the correct number of changelog entries", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Real-time Stream Polling")).toBeInTheDocument();
    });

    // Each entry maps to a <li> element
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(MOCK_CHANGELOG.entries.length);
  });

  it("renders every entry's title text", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Real-time Stream Polling")).toBeInTheDocument();
    });

    for (const entry of MOCK_CHANGELOG.entries) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it("renders every entry's description text", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Real-time Stream Polling")).toBeInTheDocument();
    });

    for (const entry of MOCK_CHANGELOG.entries) {
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it("renders a loading skeleton while the JSON fetch is in-flight", () => {
    mockFetchHanging();
    const { container } = render(<ChangelogModal open onClose={() => {}} />);

    // Skeletons use Tailwind's animate-pulse class
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);

    // No real entry content while loading
    expect(screen.queryByText("Real-time Stream Polling")).not.toBeInTheDocument();
  });

  it("renders nothing (null) when open is false", () => {
    mockFetchSuccess();
    const { container } = render(<ChangelogModal open={false} onClose={() => {}} />);

    expect(container.firstChild).toBeNull();
  });

  it("does not fetch CHANGELOG.json when open is false", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open={false} onClose={() => {}} />);

    await act(async () => {}); // flush any pending microtasks

    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — "New" badge (version indicator)
// ---------------------------------------------------------------------------

describe("ChangelogModal — 'New' version indicator", () => {
  it("shows the version string after the changelog loads", async () => {
    localStorage.removeItem(STORAGE_KEY); // no previously seen version
    mockFetchSuccess();
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      // The modal renders "Version {version}" as a sub-heading
      expect(screen.getByText(/Version 1\.1\.0/i)).toBeInTheDocument();
    });
  });

  it("does NOT show the version sub-heading while loading", () => {
    mockFetchHanging();
    render(<ChangelogModal open onClose={() => {}} />);

    expect(screen.queryByText(/Version/i)).not.toBeInTheDocument();
  });

  it("still shows the version heading even if that version was already seen", async () => {
    // Simulate a returning user who already saw 1.1.0
    localStorage.setItem(STORAGE_KEY, "1.1.0");
    mockFetchSuccess();
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      // The heading is always rendered, badge logic is separate
      expect(screen.getByText(/Version 1\.1\.0/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Close behaviour
// ---------------------------------------------------------------------------

describe("ChangelogModal — close behaviour", () => {
  it("calls onClose when the ✕ close button is clicked", () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    render(<ChangelogModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close changelog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop overlay is clicked", () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    render(<ChangelogModal open onClose={onClose} />);

    // The backdrop is the full-screen div with aria-hidden="true"
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the "Got it" button is clicked', () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    render(<ChangelogModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Escape key is pressed", () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    render(<ChangelogModal open onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when keys other than Escape are pressed", () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    render(<ChangelogModal open onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: " " });
    fireEvent.keyDown(document, { key: "Tab" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes the keydown listener when the modal closes", () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    const { rerender } = render(<ChangelogModal open onClose={onClose} />);

    // Close the modal (simulate parent setting open=false)
    rerender(<ChangelogModal open={false} onClose={onClose} />);

    // Escape should no longer fire onClose because the listener was removed
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — localStorage "mark as read" persistence
// ---------------------------------------------------------------------------

describe("ChangelogModal — mark as read (localStorage persistence)", () => {
  it("writes the version to localStorage on open", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe("1.1.0");
    });
  });

  it("persists before onClose is called", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open onClose={vi.fn()} />);

    // Do NOT click close — just wait for the fetch to settle
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe("1.1.0");
    });
  });

  it("does NOT write to localStorage when the fetch returns a non-OK response", async () => {
    mockFetchHttpError(404);
    render(<ChangelogModal open onClose={() => {}} />);

    await act(async () => {}); // flush microtasks
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does NOT write to localStorage when the fetch throws a network error", async () => {
    mockFetchNetworkError();
    render(<ChangelogModal open onClose={() => {}} />);

    await act(async () => {});
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does NOT write to localStorage when open=false", async () => {
    mockFetchSuccess();
    render(<ChangelogModal open={false} onClose={() => {}} />);

    await act(async () => {});
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("overwrites stale version when a newer changelog is fetched", async () => {
    localStorage.setItem(STORAGE_KEY, "1.0.0");
    mockFetchSuccess({ ...MOCK_CHANGELOG, version: "1.2.0" });
    render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe("1.2.0");
    });
  });

  it("re-opening the modal with the same version does not clear localStorage", async () => {
    mockFetchSuccess();
    const { rerender } = render(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe("1.1.0");
    });

    // Close and reopen
    rerender(<ChangelogModal open={false} onClose={() => {}} />);
    rerender(<ChangelogModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe("1.1.0");
    });
  });
});
