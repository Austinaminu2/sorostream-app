"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { getStreamAnalytics, type StreamAnalytics } from "@/src/lib/sorostream";
import { truncateAddress } from "@/src/lib/sorostream";
import { Skeleton } from "@/components/Skeleton";

const POLL_INTERVAL_MS = 30_000;

const PIE_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6"];

function stroopsToDisplay(stroops: number): string {
  const val = stroops / 10_000_000;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toFixed(2);
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-4">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

// Chart heights shared by the real charts and their loading placeholders so the
// layout doesn't shift when data arrives.
const VOLUME_CHART_HEIGHT = 260;
const ASSET_CHART_HEIGHT = 260;
const RECIPIENTS_CHART_HEIGHT = 300;

// The analytics page is always dark, so force the dark skeleton tone
// regardless of the site theme.
const SKELETON_TONE = "!bg-gray-700";

function ChartCardSkeleton({ height }: { height: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <Skeleton className={`h-4 w-40 ${SKELETON_TONE}`} />
      <Skeleton className={`h-3 w-64 max-w-full mt-2 mb-4 ${SKELETON_TONE}`} />
      <div className="mt-2">
        <Skeleton className={`w-full rounded-lg ${SKELETON_TONE}`} style={{ height }} />
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading analytics"
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
    >
      <div className="lg:col-span-2">
        <ChartCardSkeleton height={VOLUME_CHART_HEIGHT} />
      </div>
      <ChartCardSkeleton height={ASSET_CHART_HEIGHT} />
      <div className="lg:col-span-3">
        <ChartCardSkeleton height={RECIPIENTS_CHART_HEIGHT} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<StreamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const result = getStreamAnalytics(14);
      setData(result);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const interval = setInterval(() => void fetchAnalytics(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const assetPieData = data?.assetBreakdown.map((slice) => ({
    name: slice.asset,
    value: slice.valueStroops,
  }));

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-gray-900 text-white p-4 sm:p-8"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
              >
                ← Home
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Stream Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">
              Streaming volume, top recipients, and asset breakdown. No wallet required.
            </p>
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-500 tabular-nums">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {loading && !data ? (
          <AnalyticsSkeleton />
        ) : data ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 animate-fade-in">
            {/* Streaming volume over time */}
            <div className="lg:col-span-2">
              <ChartCard
                title="Streaming volume over time"
                subtitle="Total deposit value that began streaming per day (last 14 days)"
              >
                <ResponsiveContainer width="100%" height={VOLUME_CHART_HEIGHT}>
                  <AreaChart data={data.volumeOverTime} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-usdc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="grad-xlm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={stroopsToDisplay} />
                    <Tooltip
                      contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                      formatter={((value: number | string | undefined, name: string) => [
                        `${stroopsToDisplay(Number(value ?? 0))} ${name.toUpperCase()}`,
                        name,
                      ]) as any}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="usdc" name="USDC" stroke="#22c55e" strokeWidth={2} fill="url(#grad-usdc)" />
                    <Area type="monotone" dataKey="xlm" name="XLM" stroke="#3b82f6" strokeWidth={2} fill="url(#grad-xlm)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Asset breakdown */}
            <ChartCard
              title="Asset breakdown"
              subtitle="Value locked per asset"
            >
              <ResponsiveContainer width="100%" height={ASSET_CHART_HEIGHT}>
                <PieChart>
                  <Pie
                    data={assetPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => entry.name}
                  >
                    {assetPieData?.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={((value: number | string | undefined) => stroopsToDisplay(Number(value ?? 0))) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Top recipients */}
            <div className="lg:col-span-3">
              <ChartCard
                title="Top recipients"
                subtitle="Recipients ranked by total streamed value"
              >
                <ResponsiveContainer width="100%" height={RECIPIENTS_CHART_HEIGHT}>
                  <BarChart data={data.topRecipients} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="recipient"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(value: string) => truncateAddress(value)}
                    />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={stroopsToDisplay} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                      formatter={((value: number | string | undefined) => [`${stroopsToDisplay(Number(value ?? 0))}`, "Value"]) as any}
                      labelFormatter={(label) => truncateAddress(String(label))}
                    />
                    <Bar dataKey="totalStroops" name="Value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        ) : (
          <div
            role="alert"
            className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm"
          >
            Unable to load analytics.
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-600">
          Auto-refreshes every 30 seconds · Data from Soroban RPC + indexer
        </p>
      </div>
    </main>
  );
}
