import { render, cleanup } from "@testing-library/react";
import VestingChart from "../VestingChart";
import type { StreamData } from "@/src/lib/sorostream";
import type { StreamHistoryEntry } from "@/src/lib/export";

// ---------------------------------------------------------------------------
// recharts is mocked so the chart renders as plain divs in jsdom — this avoids
// canvas/ResponsiveContainer sizing issues while letting us assert on the
// props each chart primitive receives.
// ---------------------------------------------------------------------------

const mockProps: Record<string, Array<Record<string, unknown>>> = {};

vi.mock("recharts", () => {
  const React = require("react");
  const renderer = (name: string) => {
    const Component = (props: Record<string, unknown>) => {
      mockProps[name] = mockProps[name] || [];
      mockProps[name].push(props);
      return React.createElement(
        "div",
        { "data-testid": `recharts-${name}` },
        props.children as React.ReactNode,
      );
    };
    Component.displayName = name;
    return Component;
  };
  return {
    LineChart: renderer("LineChart"),
    Line: renderer("Line"),
    XAxis: renderer("XAxis"),
    YAxis: renderer("YAxis"),
    Tooltip: renderer("Tooltip"),
    ResponsiveContainer: renderer("ResponsiveContainer"),
    ReferenceLine: renderer("ReferenceLine"),
    ReferenceDot: renderer("ReferenceDot"),
    CartesianGrid: renderer("CartesianGrid"),
  };
});

vi.mock("@/src/lib/theme", () => ({
  useTheme: () => ({
    theme: "dark",
    isSystem: false,
    toggle: vi.fn(),
    setTheme: vi.fn(),
    useSystemTheme: vi.fn(),
  }),
}));

const START_MS = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01T00:00:00Z
const END_MS = Date.UTC(2026, 1, 1, 0, 0, 0); // 2026-02-01T00:00:00Z

const STREAM: StreamData = {
  id: "chart-test",
  sender: "GB7TJKR6KZ3L3LYPZNAZQJR4HGLJ4E7MSTFJZXQZ2RL4QJKZKSX6JQJ5",
  recipient: "GCZEAELPDHRCOS7XZAFAQ7TMURYCMDH5GB6MLCO4KDYK3AS3HFEIY2EZ",
  token: "USDC",
  flowRate: 100, // stroops per second
  deposit: 30_000, // stroops
  startTime: new Date(START_MS).toISOString(),
  endTime: new Date(END_MS).toISOString(),
  lastWithdrawTime: "",
  status: "Active",
};

function chartProps(name: string): Array<Record<string, unknown>> {
  return mockProps[name] ?? [];
}

describe("VestingChart", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockProps)) delete mockProps[key];
    vi.useFakeTimers();
    vi.setSystemTime(START_MS + 60_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("generates 30 evenly-spaced chart data points from start to end", () => {
    render(<VestingChart stream={STREAM} history={[]} />);

    const lineChart = chartProps("LineChart")[0];
    const data = (lineChart?.data as Array<{ time: number; vested: number }>) ?? [];

    expect(data).toHaveLength(30);

    const numPoints = 30;
    data.forEach((point, i) => {
      const expectedTime = START_MS + (END_MS - START_MS) * (i / (numPoints - 1));
      expect(point.time).toBeCloseTo(expectedTime, 6);
    });

    // First point sits exactly on startTime, last exactly on endTime.
    expect(data[0].time).toBe(START_MS);
    expect(data[29].time).toBe(END_MS);
  });

  it("caps vested amounts at the deposit", () => {
    const stream: StreamData = {
      ...STREAM,
      deposit: 1_000,
      flowRate: 100,
    };
    render(<VestingChart stream={stream} history={[]} />);

    const data = (chartProps("LineChart")[0]?.data as Array<{ vested: number }>) ?? [];
    expect(data.length).toBeGreaterThan(0);

    for (const point of data) {
      expect(point.vested).toBeLessThanOrEqual(1_000);
    }

    // A point far enough past the start should saturate at the deposit cap.
    const saturated = data.find((p) => p.vested === 1_000);
    expect(saturated).toBeDefined();
  });

  it("computes nowVested from the current time when the stream is still vesting", () => {
    // 60 seconds in → flowRate 100/s → 6,000 stroops vested (< deposit).
    vi.setSystemTime(START_MS + 60_000);
    render(<VestingChart stream={STREAM} history={[]} />);

    const dot = chartProps("ReferenceDot")[0];
    expect((dot?.y as number)).toBe(6_000);
  });

  it("caps nowVested at the deposit once the stream is fully vested", () => {
    // 1,000 seconds in → 100,000 stroops would be vested, capped by deposit.
    vi.setSystemTime(START_MS + 1_000_000);
    render(<VestingChart stream={STREAM} history={[]} />);

    const dot = chartProps("ReferenceDot")[0];
    expect((dot?.y as number)).toBe(30_000);
  });

  it("reports zero vested when current time is before the stream start", () => {
    vi.setSystemTime(START_MS - 60_000);
    render(<VestingChart stream={STREAM} history={[]} />);

    const dot = chartProps("ReferenceDot")[0];
    expect((dot?.y as number)).toBe(0);
  });

  it("renders one ReferenceLine per withdrawal in the history", () => {
    const history: StreamHistoryEntry[] = [
      { timestamp: "2026-01-05T00:00:00Z", type: "withdrawal", amount: "50000000", txHash: "tx-1" },
      { timestamp: "2026-01-08T00:00:00Z", type: "top-up", amount: "10000000", txHash: "tx-2" },
      { timestamp: "2026-01-10T00:00:00Z", type: "withdrawal", amount: "25000000", txHash: "tx-3" },
      { timestamp: "2026-01-12T00:00:00Z", type: "creation", amount: "0", txHash: "tx-4" },
    ];

    render(<VestingChart stream={STREAM} history={history} />);

    const lines = chartProps("ReferenceLine");
    expect(lines).toHaveLength(2);

    const expectedXs = ["2026-01-05T00:00:00Z", "2026-01-10T00:00:00Z"].map((ts) =>
      new Date(ts).getTime(),
    );
    const actualXs = lines.map((l) => l.x).sort((a, b) => (a as number) - (b as number));
    expect(actualXs).toEqual(expectedXs.sort((a, b) => a - b));
  });
});