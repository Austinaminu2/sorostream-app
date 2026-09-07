"use client";

import {
  getAddress,
  getNetwork,
  signTransaction as freighterSignTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";

export type { WatchWalletChanges };

export const APP_NETWORK = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet"
).toLowerCase();

export function createWatchWalletChanges(timeout?: number) {
  return new WatchWalletChanges(timeout);
}

/**
 * Fetch the network the Freighter wallet is currently set to.
 * Returns `null` when Freighter is unavailable or not yet allowed.
 */
export async function getWalletNetwork(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const result = await getNetwork();
    if (result.error || !result.network) return null;
    return result.network.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns `true` when the wallet's active network matches the app's configured
 * network (`NEXT_PUBLIC_STELLAR_NETWORK`). Returns `null` when the network
 * cannot be determined (Freighter not installed / not yet connected).
 */
export async function checkNetworkMatch(): Promise<boolean | null> {
  const walletNetwork = await getWalletNetwork();
  if (walletNetwork === null) return null;
  return walletNetwork === APP_NETWORK;
}

/**
 * Fetch the currently selected account address from Freighter.
 * Returns an empty string when Freighter is unavailable.
 */
export async function getActiveAddress(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const result = await getAddress();
    if (!result.error && result.address) return result.address;
  } catch {
    // fall through to legacy path
  }
  try {
    const freighter = (window as { freighter?: { getPublicKey: () => Promise<string> } }).freighter;
    if (!freighter) return "";
    return (await freighter.getPublicKey()) ?? "";
  } catch {
    return "";
  }
}

/** Default timeout (ms) for a Freighter signature request. */
export const SIGN_TRANSACTION_TIMEOUT_MS = 60_000;

export class SessionExpiredWalletError extends Error {
  constructor(message = FRIENDLY_SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredWalletError";
  }
}

export const FRIENDLY_SESSION_EXPIRED_MESSAGE =
  "Your wallet session has expired. Please reconnect to continue.";

export function isSessionExpiredError(err: unknown): boolean {
  if (err instanceof SessionExpiredWalletError) return true;
  const message =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : "";
  return /session expired|wallet session has expired|expired session|failed to parse xdr|parse xdr|not connected to freighter|request timed out|timeout/i.test(
    message,
  );
}

/**
 * Error surfaced to the user when Freighter never returns a signature
 * (e.g. the wallet popup was dismissed, the extension hung, or the user
 * simply never approved the request).
 */
export const FREIGHTER_SIGN_TIMEOUT_MESSAGE =
  "Freighter didn't respond in time. Make sure the wallet is unlocked and you approved the request, then try again.";

export interface SignTransactionOptions {
  /** Override the default signature timeout. */
  timeoutMs?: number;
}

/**
 * Request a signature from Freighter, rejecting with a clear error if the
 * wallet does not respond within `timeoutMs` (default 60s) instead of hanging
 * indefinitely. Also rejects when the user rejects the request or Freighter
 * returns an error, so callers can surface the failure rather than silently
 * receiving the unsigned XDR back.
 */
export async function signTransaction(
  xdr: string,
  options: SignTransactionOptions = {},
): Promise<string> {
  if (typeof window === "undefined") return xdr;

  const timeoutMs = options.timeoutMs ?? SIGN_TRANSACTION_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(FREIGHTER_SIGN_TIMEOUT_MESSAGE));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      freighterSignTransaction(xdr),
      timeoutPromise,
    ]);

    if (result.error) {
      const message = String(result.error);
      if (/reject/i.test(message)) {
        throw new Error("Signature request was rejected in Freighter.");
      }
      throw new Error(`Freighter signing failed: ${message}`);
    }

    return result.signedTxXdr ?? xdr;
  } finally {
    clearTimeout(timer!);
  }
}

export async function getFreighterAdapter() {
  return {
    isConnected: async () => {
      if (typeof window === "undefined") return false;
      return !!(window as { freighter?: unknown }).freighter;
    },
    getPublicKey: getActiveAddress,
    signTransaction,
  };
}

export async function connectWallet(): Promise<string> {
  return getActiveAddress();
}

export async function getPublicKey(): Promise<string> {
  return getActiveAddress();
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return !!(window as { freighter?: unknown }).freighter;
}

