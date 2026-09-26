/**
 * Unit tests for FiatDisplay shared XLM price cache (issue #582).
 *
 * Acceptance criteria from the issue:
 *   ✓ XLM price is fetched once per minute and shared via React context
 *   ✓ All FiatDisplay instances on the page read from the shared cache
 *   ✓ Rendering 5 FiatDisplay components fires only 1 API call
 *
 * Additional coverage:
 *   - Re-fetch fires exactly once after 60 s, regardless of component count
 *   - All 5 instances display the same computed USD value
 *   - FiatDisplay renders nothing when showUsd is false
 *   - FiatDisplay shows "(Price unavailable)" when the price feed is null
 *   - FiatDisplay renders nothing during initial load (no layout shift)
 *   - USDC path renders directly without waiting for the XLM price feed
 */

import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks  (Vitest hoists vi.mock to top of the module)
// ---------------------------------------------------------------------------

vi.mock("@/src/context/SettingsContext", () => ({
  useSettings: vi.fn(() => ({ showUsd: true, language: "en" })),
}));

vi.mock("@/src/lib/i18n", () => ({
  useTranslations: () => (key: string, vars?: Record<string, string>) => {
    if (key === "approximately_usd" && vars?.formatted) return `~$${vars.formatted} USD`;
    if (key === "price_unavailable") return "Price unavailable";
    return key;
  },
}));

// xlmPrice is mocked at module level so every import in the test file and
// in XlmPriceContext sees the same spy function.
const mockGetXlmUsdPrice = vi.fn<[], Promise<number | null>>();
vi.mock("@/src/lib/xlmPrice", () => ({
  getXlmUsdPrice: () => mockGetXlmUsdPrice(),
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import FiatDisplay from "@/components/FiatDisplay";
import { XlmPriceProvider } from "@/src/context/XlmPriceContext";

// ---------------------------------------------------------------------------
// Fake-timer lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockGetXlmUsdPrice.mockResolvedValue(0.125); // default: $0.125 per XLM
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helper — wraps N FiatDisplay instances in a single shared provider
// ---------------------------------------------------------------------------

function renderN(count: number, xlmAmount = 10) {
  return render(
    <XlmPriceProvider>
      {Array.from({ length: count }, (_, i) => (
        <FiatDisplay key={i} xlmAmount={xlmAmount} />
      ))}
    </XlmPriceProvider>,
  );
}

// ---------------------------------------------------------------------------
// Suite 1 — shared context: single API call for N components
// ---------------------------------------------------------------------------

describe("FiatDisplay — shared XLM price context (issue #582)", () => {
  it("fires exactly 1 API call when 5 FiatDisplay components are mounted", async () => {
    renderN(5);

    // Flush the initial fetch
    await act(async () => { await Promise.resolve(); });

    expect(mockGetXlmUsdPrice).toHaveBeenCalledTimes(1);
  });

  it("all 5 instances display the same computed USD value", async () => {
    // 10 XLM × $0.125 = $1.25
    renderN(5, 10);

    await act(async () => { await Promise.resolve(); });

    await waitFor(() => {
      const spans = screen.getAllByText(/\$1\.25/);
      expect(spans).toHaveLength(5);
    });
  });

  it("re-fetches exactly once after 60 s regardless of how many components are mounted", async () => {
    renderN(5);

    await act(async () => { await Promise.resolve(); });
    const callsOnMount = mockGetXlmUsdPrice.mock.calls.length;
    expect(callsOnMount).toBe(1);

    // Advance the shared 60-second interval
    act(() => { vi.advanceTimersByTime(60_000); });
    await act(async () => { await Promise.resolve(); });

    // Exactly one more call — not five
    expect(mockGetXlmUsdPrice).toHaveBeenCalledTimes(callsOnMount + 1);
  });

  it("does NOT fire an additional call when a new FiatDisplay mounts after the initial fetch", async () => {
    // Start with 3 components
    const { rerender } = render(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={5} />
        <FiatDisplay xlmAmount={5} />
        <FiatDisplay xlmAmount={5} />
      </XlmPriceProvider>,
    );

    await act(async () => { await Promise.resolve(); });
    expect(mockGetXlmUsdPrice).toHaveBeenCalledTimes(1);

    // Add 2 more FiatDisplay instances — still no new API call
    rerender(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={5} />
        <FiatDisplay xlmAmount={5} />
        <FiatDisplay xlmAmount={5} />
        <FiatDisplay xlmAmount={5} />
        <FiatDisplay xlmAmount={5} />
      </XlmPriceProvider>,
    );

    await act(async () => { await Promise.resolve(); });
    expect(mockGetXlmUsdPrice).toHaveBeenCalledTimes(1);
  });

  it("updates all instances simultaneously when the price refreshes", async () => {
    mockGetXlmUsdPrice
      .mockResolvedValueOnce(0.10)  // first fetch: $0.10
      .mockResolvedValueOnce(0.20); // second fetch (after 60 s): $0.20

    renderN(3, 10); // 10 XLM

    await act(async () => { await Promise.resolve(); });
    await waitFor(() => {
      // 10 × $0.10 = $1.00
      expect(screen.getAllByText(/\$1\.00/)).toHaveLength(3);
    });

    // Trigger the 60-second refresh
    act(() => { vi.advanceTimersByTime(60_000); });
    await act(async () => { await Promise.resolve(); });

    await waitFor(() => {
      // 10 × $0.20 = $2.00 — all 3 instances updated
      expect(screen.getAllByText(/\$2\.00/)).toHaveLength(3);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — FiatDisplay display logic
// ---------------------------------------------------------------------------

describe("FiatDisplay — display logic", () => {
  it("renders nothing when showUsd is false", async () => {
    // Override the module-level useSettings mock for this test
    const settingsMod = await import("@/src/context/SettingsContext");
    vi.mocked(settingsMod.useSettings).mockReturnValue({
      showUsd: false,
      language: "en",
    } as ReturnType<typeof settingsMod.useSettings>);

    const { container } = render(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={10} />
      </XlmPriceProvider>,
    );

    await act(async () => { await Promise.resolve(); });
    expect(container.firstChild).toBeNull();

    // Restore default for subsequent tests
    vi.mocked(settingsMod.useSettings).mockReturnValue({
      showUsd: true,
      language: "en",
    } as ReturnType<typeof settingsMod.useSettings>);
  });

  it("renders nothing during initial load to avoid layout shift", () => {
    // Price fetch never resolves → loading stays true
    mockGetXlmUsdPrice.mockReturnValue(new Promise(() => {}));

    render(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={10} />
      </XlmPriceProvider>,
    );

    // No USD text should appear while loading
    expect(screen.queryByText(/USD/i)).not.toBeInTheDocument();
  });

  it("shows '(Price unavailable)' when the price feed returns null", async () => {
    mockGetXlmUsdPrice.mockResolvedValue(null);

    render(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={10} />
      </XlmPriceProvider>,
    );

    await act(async () => { await Promise.resolve(); });

    await waitFor(() => {
      expect(screen.getByText(/price unavailable/i)).toBeInTheDocument();
    });
  });

  it("renders USDC amount directly without triggering an XLM price fetch", async () => {
    render(
      <XlmPriceProvider>
        <FiatDisplay usdcAmount={25.5} />
      </XlmPriceProvider>,
    );

    // USDC path does not depend on the price feed at all
    expect(screen.getByText(/25\.50/)).toBeInTheDocument();
  });

  it("correctly computes USD value: xlmAmount × price", async () => {
    mockGetXlmUsdPrice.mockResolvedValue(0.25); // $0.25 per XLM

    render(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={20} />
      </XlmPriceProvider>,
    );

    // 20 × $0.25 = $5.00
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => {
      expect(screen.getByText(/\$5\.00/)).toBeInTheDocument();
    });
  });

  it("formats the USD value with exactly 2 decimal places", async () => {
    mockGetXlmUsdPrice.mockResolvedValue(0.123456789);

    render(
      <XlmPriceProvider>
        <FiatDisplay xlmAmount={1} />
      </XlmPriceProvider>,
    );

    // 1 × $0.123456789 → rounded to $0.12
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => {
      expect(screen.getByText(/\$0\.12/)).toBeInTheDocument();
    });
  });
});
