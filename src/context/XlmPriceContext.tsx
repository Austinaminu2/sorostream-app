"use client";
/**
 * XlmPriceContext — shared XLM/USD price cache for the whole app (issue #582).
 *
 * Problem: each FiatDisplay instance previously called useXlmPrice() independently,
 * which caused N simultaneous price API requests when N FiatDisplay components were
 * mounted at once (e.g. 20 stream cards on the dashboard = 20 CoinGecko calls).
 *
 * Solution: a single provider fetches the price once per minute and all consumers
 * read from the shared context value. Zero duplicate network calls.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getXlmUsdPrice } from "@/src/lib/xlmPrice";

/** How often the shared price is refreshed (1 minute). */
const SHARED_REFRESH_INTERVAL_MS = 60 * 1_000;

interface XlmPriceContextValue {
  /** Latest XLM/USD price, or null when unavailable. */
  price: number | null;
  /** True only during the very first fetch (no price yet). */
  loading: boolean;
}

const XlmPriceContext = createContext<XlmPriceContextValue | undefined>(undefined);

export function XlmPriceProvider({ children }: { children: ReactNode }) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Track whether the component is still mounted to avoid state updates after unmount.
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function refresh() {
      const p = await getXlmUsdPrice();
      if (!cancelledRef.current) {
        setPrice(p);
        setLoading(false);
      }
    }

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, SHARED_REFRESH_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <XlmPriceContext.Provider value={{ price, loading }}>
      {children}
    </XlmPriceContext.Provider>
  );
}

/**
 * Read the shared XLM/USD price.
 * Must be called inside a component tree wrapped by XlmPriceProvider.
 */
export function useSharedXlmPrice(): XlmPriceContextValue {
  const ctx = useContext(XlmPriceContext);
  if (ctx === undefined) {
    throw new Error("useSharedXlmPrice must be used within XlmPriceProvider");
  }
  return ctx;
}
