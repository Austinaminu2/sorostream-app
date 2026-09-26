import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import ChangelogModal, { useChangelogUnread } from "@/components/ChangelogModal";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock @/src/lib/useFocusTrap — the real implementation uses
// requestAnimationFrame and DOM focus management which can cause noise in
// jsdom. Stubbing it out keeps these tests focused on ChangelogModal's own
// rendering and data-fetching logic.
// ---------------------------------------------------------------------------

vi.mock("@/src/lib/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Changelog fixture
// ---------------------------------------------------------------------------

const MOCK_CHANGELOG = {
  version: "2.4.0",
  entries: [
    {
      icon: "🚀",
      title: "Batch stream creation",
      description: "Create up to 50 streams in a single transaction.",
    },
    {
      icon: "🔒",
      title: "Two-factor authentication",
      description: "Secure your account with TOTP-based 2FA.",
    },
    {
      icon: "📊",
      title: "Analytics dashboard",
      description: "Track TVL, volume, and top recipients in real time.",
    },
  ],
};

// ---------------------------------------------------------------------------
// fetch helper — returns a Response-like object that resolves to the fixture.
// ---------------------------------------------------------------------------

function makeFetchOk(data: object) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    } as Response),
  );
}

function makeFetchError() {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      json: () => Promise.reject(new Error("not ok")),
    } as unknown as Response),
  );
}

function makeFetchThrow() {
  return vi.fn(() => Promise.reject(new Error("network error")));
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "sorostream-changelog-seen";

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangelogModal", () => {
  beforeEach(() => {
    clearStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearStorage();
  });

  // ── open / closed guard ───────────────────────────────────────────────────

  describe("open/closed guard", () => {
    it("renders nothing when open=false", () => {
      const { container } = render(
        <ChangelogModal open={false} onClose={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the dialog when open=true", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });
      expect(
        screen.getByRole("dialog", { name: /What's new in SoroStream/i }),
      ).toBeInTheDocument();
    });
  });

  // ── loading skeleton ──────────────────────────────────────────────────────

  describe("loading skeleton", () => {
    it("shows a skeleton while the fetch is in flight", () => {
      // fetch never resolves during this test
      let resolveFetch!: () => void;
      global.fetch = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = () =>
              resolve({
                ok: true,
                json: () => Promise.resolve(MOCK_CHANGELOG),
              } as Response);
          }),
      );

      render(<ChangelogModal open={true} onClose={vi.fn()} />);

      // While pending, entries list is absent and skeleton divs are present
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      // The skeleton container renders 4 placeholder rows
      const pulseEls = document.querySelectorAll(".animate-pulse");
      expect(pulseEls.length).toBeGreaterThan(0);

      // Clean up: let the promise resolve so no unhandled rejection leaks
      act(() => { resolveFetch(); });
    });
  });

  // ── entry count ───────────────────────────────────────────────────────────

  describe("renders the correct number of changelog entries", () => {
    it("renders one <li> per entry in the changelog", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(MOCK_CHANGELOG.entries.length);
    });

    it("renders the title of every entry", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      for (const entry of MOCK_CHANGELOG.entries) {
        expect(screen.getByText(entry.title)).toBeInTheDocument();
      }
    });

    it("renders the description of every entry", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      for (const entry of MOCK_CHANGELOG.entries) {
        expect(screen.getByText(entry.description)).toBeInTheDocument();
      }
    });

    it("displays the version number in the header", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      expect(screen.getByText(`Version ${MOCK_CHANGELOG.version}`)).toBeInTheDocument();
    });
  });

  // ── "New" badge — useChangelogUnread ─────────────────────────────────────
  //
  // The ChangelogModal itself does not render a "New" badge — that UI element
  // lives in the parent (e.g. NavHeader) and is driven by the exported
  // `useChangelogUnread` hook. These tests verify the hook's contract so the
  // "New" badge renders correctly for the latest unseen version.
  // ---------------------------------------------------------------------------

  describe("useChangelogUnread — 'New' badge logic", () => {
    it("returns true (unread) when the stored version does not match the latest", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      // Simulate a user who last saw version 2.3.0
      localStorage.setItem(STORAGE_KEY, "2.3.0");

      const { result } = renderHook(() => useChangelogUnread());

      await waitFor(() => expect(result.current).toBe(true));
    });

    it("returns false (read) when the stored version matches the latest", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      // User has already seen version 2.4.0
      localStorage.setItem(STORAGE_KEY, MOCK_CHANGELOG.version);

      const { result } = renderHook(() => useChangelogUnread());

      await waitFor(() => expect(result.current).toBe(false));
    });

    it("returns true when there is no stored version at all", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      // No entry in localStorage
      clearStorage();

      const { result } = renderHook(() => useChangelogUnread());

      await waitFor(() => expect(result.current).toBe(true));
    });

    it("returns false (silently) when the fetch fails", async () => {
      global.fetch = makeFetchThrow();

      const { result } = renderHook(() => useChangelogUnread());

      // Should default to false when the network is unreachable
      await waitFor(() => expect(result.current).toBe(false));
    });

    it("returns false when the server returns a non-ok response", async () => {
      global.fetch = makeFetchError();

      const { result } = renderHook(() => useChangelogUnread());

      await waitFor(() => expect(result.current).toBe(false));
    });
  });

  // ── closing the modal calls onClose ──────────────────────────────────────

  describe("closing the modal", () => {
    it("calls onClose when the × close button is clicked", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={onClose} />);
      });

      fireEvent.click(screen.getByRole("button", { name: /Close changelog/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the 'Got it' button is clicked", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={onClose} />);
      });

      fireEvent.click(screen.getByRole("button", { name: /Got it/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the backdrop is clicked", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={onClose} />);
      });

      // The backdrop is the aria-hidden overlay div directly inside the dialog
      const backdrop = document
        .querySelector('[aria-hidden="true"]') as HTMLElement;
      expect(backdrop).not.toBeNull();
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the Escape key is pressed", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={onClose} />);
      });

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose for non-Escape key presses", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={onClose} />);
      });

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Tab" });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("removes the keydown listener when the modal closes", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();
      const addSpy = vi.spyOn(document, "addEventListener");
      const removeSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = render(
        <ChangelogModal open={true} onClose={onClose} />,
      );
      unmount();

      // removeEventListener must have been called with "keydown"
      expect(
        removeSpy.mock.calls.some(([event]) => event === "keydown"),
      ).toBe(true);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  // ── mark as read — localStorage persistence ───────────────────────────────

  describe("mark as read — localStorage", () => {
    it("persists the latest version to localStorage when the modal opens", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      await waitFor(() => {
        expect(localStorage.getItem(STORAGE_KEY)).toBe(MOCK_CHANGELOG.version);
      });
    });

    it("updates localStorage when a newer version is fetched", async () => {
      // Simulate previously having seen an older version
      localStorage.setItem(STORAGE_KEY, "1.0.0");

      global.fetch = makeFetchOk({ ...MOCK_CHANGELOG, version: "3.0.0" });

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      await waitFor(() => {
        expect(localStorage.getItem(STORAGE_KEY)).toBe("3.0.0");
      });
    });

    it("does not write to localStorage when the fetch fails", async () => {
      global.fetch = makeFetchThrow();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      // localStorage should remain empty
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not write to localStorage when open=false", () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      render(<ChangelogModal open={false} onClose={vi.fn()} />);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("re-fetches and re-marks as read if the modal is closed and reopened", async () => {
      global.fetch = makeFetchOk(MOCK_CHANGELOG);
      const onClose = vi.fn();

      const { rerender } = render(
        <ChangelogModal open={true} onClose={onClose} />,
      );

      await waitFor(() =>
        expect(localStorage.getItem(STORAGE_KEY)).toBe(MOCK_CHANGELOG.version),
      );

      // Close the modal
      rerender(<ChangelogModal open={false} onClose={onClose} />);

      // Set up the newer fetch mock BEFORE reopening
      const newerChangelog = { ...MOCK_CHANGELOG, version: "5.0.0" };
      global.fetch = makeFetchOk(newerChangelog);

      // Reopen — should trigger a new load() call with the new mock
      await act(async () => {
        rerender(<ChangelogModal open={true} onClose={onClose} />);
      });

      await waitFor(() =>
        expect(localStorage.getItem(STORAGE_KEY)).toBe("5.0.0"),
      );
    });
  });

  // ── error resilience ──────────────────────────────────────────────────────

  describe("error resilience", () => {
    it("renders the dialog shell even when fetch throws", async () => {
      global.fetch = makeFetchThrow();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      // The dialog itself should still be visible (graceful degradation)
      expect(
        screen.getByRole("dialog", { name: /What's new in SoroStream/i }),
      ).toBeInTheDocument();
    });

    it("renders the dialog shell when the server returns non-ok", async () => {
      global.fetch = makeFetchError();

      await act(async () => {
        render(<ChangelogModal open={true} onClose={vi.fn()} />);
      });

      expect(
        screen.getByRole("dialog", { name: /What's new in SoroStream/i }),
      ).toBeInTheDocument();
    });
  });
});
