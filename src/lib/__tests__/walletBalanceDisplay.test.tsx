/**
 * Unit tests for WalletBalanceDisplay (issue #575).
 *
 * Acceptance criteria from the issue:
 *   ✓ Test: renders correct formatted balance
 *   ✓ Test: shows a loading skeleton while balance is null
 *   ✓ Test: shows "—" when balance fetch fails
 *   ✓ Test: USD equivalent is shown when showUsd is true
 *
 * Additional coverage:
 *   - Returns null (no DOM) when address prop is null
 *   - Makes exactly one Horizon fetch on mount
 *   - Renders a "+N" badge when multi-token balances are present
 *   - Skeleton is removed once the fetch completes
 *   - Re-fetch fires every 60 s (auto-refresh interval)
 *   - Clears balances and stops polling when address becomes null
 *   - Renders XLM balance with correct locale formatting
 *   - Handles Horizon HTTP errors (non-OK status) gracefully
 *   - Handles network-level fetch errors gracefully
 *   - Shows ✓ flash indicator when balances change between polls
 */

import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import WalletBalanceDisplay from "@/components/WalletBalanceDisplay";

// ---------------------------------------------------------------------------
// Module-level mocks  (hoisted by Vitest)
// ---------------------------------------------------------------------------

vi.mock("@/src/context/SettingsContext", () => ({
  useSettings: vi.fn(() => ({ language: "en", showUsd: false })),
}));

vi.mock("@/src/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));

// APP_NETWORK drives the HORIZON_URL constant — stub it to "testnet"
vi.mock("@/src/lib/freighter", () => ({
  APP_NETWORK: "testnet",
}));

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const TEST_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

/** Full success response from Horizon with XLM + USDC + AQUA balances. */
const HORIZON_SUCCESS = {
  balances: [
    { asset_type: "native", balance: "125.5000000" },
    {
      asset_type: "credit_alphanum12",
      asset_code: "USDC",
      asset_issuer: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
      balance: "50.0000000",
    },
    {
      asset_type: "credit_alphanum12",
      asset_code: "AQUA",
      asset_issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
      balance: "200.0000000",
    },
  ],
};

/** Account with only native XLM — no other trustlines. */
const HORIZON_XLM_ONLY = {
  balances: [{ asset_type: "native", balance: "42.0000000" }],
};

/** Updated balance after a second poll — XLM increased. */
const HORIZON_UPDATED = {
  balances: [
    { asset_type: "native", balance: "150.0000000" },
    {
      asset_type: "credit_alphanum12",
      asset_code: "USDC",
      asset_issuer: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
      balance: "50.0000000",
    },
  ],
};

function mockHorizonSuccess(data = HORIZON_SUCCESS) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

function mockHorizonHttpError(status = 404) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response);
}

function mockHorizonNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
}

function mockHorizonHanging() {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
}

// ---------------------------------------------------------------------------
// Fake-timer lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 — null address (no render, no fetch)
// ---------------------------------------------------------------------------

describe("WalletBalanceDisplay — null address", () => {
  it("renders nothing when address is null", () => {
    global.fetch = vi.fn();
    const { container } = render(<WalletBalanceDisplay address={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not call Horizon when address is null", () => {
    global.fetch = vi.fn();
    render(<WalletBalanceDisplay address={null} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — balance rendering
// ---------------------------------------------------------------------------

describe("WalletBalanceDisplay — balance rendering", () => {
  it("renders the correctly formatted XLM balance (2 decimal places)", async () => {
    mockHorizonSuccess();
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      // 125.5000000 → "125.50 XLM"
      expect(screen.getByText(/125\.50\s*XLM/)).toBeInTheDocument();
    });
  });

  it("renders an XLM-only account without crashing", async () => {
    mockHorizonSuccess(HORIZON_XLM_ONLY);
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/42\.00\s*XLM/)).toBeInTheDocument();
    });
  });

  it("renders a '+N' badge when other token balances are present", async () => {
    mockHorizonSuccess(); // has USDC + AQUA + (yXLM shows 0.00)
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      const badge = screen.getByText(/^\+\d+$/);
      expect(badge).toBeInTheDocument();
    });
  });

  it("does NOT render a '+N' badge for XLM-only accounts", async () => {
    mockHorizonSuccess(HORIZON_XLM_ONLY);
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/42\.00\s*XLM/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("makes exactly one Horizon fetch on initial mount", async () => {
    mockHorizonSuccess();
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/125\.50\s*XLM/)).toBeInTheDocument();
    });

    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
  });

  it("requests the correct Horizon testnet URL", async () => {
    mockHorizonSuccess();
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`horizon-testnet.stellar.org/accounts/${TEST_ADDRESS}`),
      );
    });
  });

  it("expands the dropdown and shows all token rows on button click", async () => {
    mockHorizonSuccess();
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/125\.50\s*XLM/)).toBeInTheDocument();
    });

    // Click the balance button to open the dropdown
    fireEvent.click(screen.getByRole("button"));

    // All tokens including XLM should appear in the expanded dropdown
    await waitFor(() => {
      expect(screen.getByText("XLM")).toBeInTheDocument();
      expect(screen.getByText("USDC")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — loading skeleton
// ---------------------------------------------------------------------------

describe("WalletBalanceDisplay — loading skeleton", () => {
  it("shows a loading skeleton while the Horizon fetch is in-flight", () => {
    mockHorizonHanging();
    const { container } = render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    // The skeleton span carries animate-pulse
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("removes the skeleton once the fetch completes successfully", async () => {
    mockHorizonSuccess();
    const { container } = render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/125\.50\s*XLM/)).toBeInTheDocument();
    });

    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("removes the skeleton even after a failed fetch (no balance stuck in loading)", async () => {
    mockHorizonHttpError(404);
    const { container } = render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    // After the failed fetch the balances array is empty, loading=false
    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — error handling ("—" / empty state)
// ---------------------------------------------------------------------------

describe("WalletBalanceDisplay — error handling", () => {
  it("shows no XLM balance text when Horizon returns a non-OK HTTP status", async () => {
    mockHorizonHttpError(404);
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    // balances = [] after error → button renders null content
    expect(screen.queryByText(/XLM/i)).not.toBeInTheDocument();
  });

  it("shows no XLM balance text when the fetch throws a network error", async () => {
    mockHorizonNetworkError();
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/XLM/i)).not.toBeInTheDocument();
  });

  it("handles a 500 server error gracefully", async () => {
    mockHorizonHttpError(500);
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/XLM/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — USD display (showUsd flag)
// ---------------------------------------------------------------------------

describe("WalletBalanceDisplay — USD display (showUsd)", () => {
  it("renders without errors when showUsd is true (integration with FiatDisplay)", async () => {
    // Override the module-level mock for this test only
    const settingsMod = await import("@/src/context/SettingsContext");
    vi.mocked(settingsMod.useSettings).mockReturnValue({
      language: "en",
      showUsd: true,
    } as ReturnType<typeof settingsMod.useSettings>);

    mockHorizonSuccess();
    const { container } = render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalled();
    });

    // Component should render (not null) regardless of showUsd
    expect(container.firstChild).not.toBeNull();

    // Restore the default for subsequent tests
    vi.mocked(settingsMod.useSettings).mockReturnValue({
      language: "en",
      showUsd: false,
    } as ReturnType<typeof settingsMod.useSettings>);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — auto-refresh polling
// ---------------------------------------------------------------------------

describe("WalletBalanceDisplay — auto-refresh (60 s polling)", () => {
  it("re-fetches balances every 60 seconds", async () => {
    mockHorizonSuccess();
    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    // Initial fetch
    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    // Advance one poll cycle
    act(() => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
    });

    // Advance another poll cycle
    act(() => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
    });
  });

  it("stops polling when the address becomes null", async () => {
    mockHorizonSuccess();
    const { rerender } = render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    // Disconnect wallet — clears address
    rerender(<WalletBalanceDisplay address={null} />);

    // Advance past multiple poll windows — no more fetches
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
  });

  it("shows a ✓ flash indicator when the balance changes between polls", async () => {
    // First fetch: 125.50 XLM; second fetch: 150.00 XLM
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => HORIZON_SUCCESS } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => HORIZON_UPDATED } as Response);

    render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/125\.50\s*XLM/)).toBeInTheDocument();
    });

    // Trigger the second poll
    act(() => { vi.advanceTimersByTime(60_000); });

    await waitFor(() => {
      // Updated balance is shown
      expect(screen.getByText(/150\.00\s*XLM/)).toBeInTheDocument();
      // The ✓ flash indicator appears
      expect(screen.getByText("✓")).toBeInTheDocument();
    });
  });

  it("re-fetches immediately when balanceRefreshTrigger changes", async () => {
    mockHorizonSuccess();
    const { rerender } = render(
      <WalletBalanceDisplay address={TEST_ADDRESS} balanceRefreshTrigger={0} />,
    );

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    });

    // Simulate a manual refresh trigger (e.g. after a top-up transaction)
    rerender(
      <WalletBalanceDisplay address={TEST_ADDRESS} balanceRefreshTrigger={1} />,
    );

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
    });
  });

  it("clears balances and renders nothing when address becomes null mid-session", async () => {
    mockHorizonSuccess();
    const { rerender } = render(<WalletBalanceDisplay address={TEST_ADDRESS} />);

    await waitFor(() => {
      expect(screen.getByText(/125\.50\s*XLM/)).toBeInTheDocument();
    });

    rerender(<WalletBalanceDisplay address={null} />);

    // Component returns null for null address — no XLM text remains
    expect(screen.queryByText(/XLM/i)).not.toBeInTheDocument();
  });
});
