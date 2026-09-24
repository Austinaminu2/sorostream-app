"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useFocusTrap } from "@/src/lib/useFocusTrap";
import { sorostream } from "@/src/lib/sorostream";
import { useWallet } from "@/src/context/WalletContext";
import { useToast } from "@/src/lib/toast";

interface GiftStreamModalProps {
  onClose: () => void;
}

const SUPPORTED_TOKENS = [
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "XLM", name: "Stellar Lumens" },
  { symbol: "AQUA", name: "Aquarius" },
  { symbol: "yXLM", name: "Yield XLM" },
] as const;

const DURATION_PRESETS = [
  { label: "7 days", seconds: 7 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
  { label: "90 days", seconds: 90 * 86400 },
  { label: "1 year", seconds: 365 * 86400 },
] as const;

/** Stores the gift message alongside the stream ID, client-side only. */
const GIFT_MESSAGES_KEY = "sorostream-gift-messages";

export function getGiftMessage(streamId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GIFT_MESSAGES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[streamId] ?? null;
  } catch {
    return null;
  }
}

function saveGiftMessage(streamId: string, message: string): void {
  try {
    const raw = localStorage.getItem(GIFT_MESSAGES_KEY);
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[streamId] = message;
    localStorage.setItem(GIFT_MESSAGES_KEY, JSON.stringify(map));
  } catch {}
}

function validateStellarAddress(value: string) {
  if (!value) return "Recipient address is required.";
  if (!/^G[A-Z2-7]{55}$/.test(value)) return "Must be a valid Stellar public key (G…, 56 chars).";
  return "";
}

type GiftStep = "form" | "confirming" | "done";

interface GiftResult {
  streamId: string;
  shareUrl: string;
}

export default function GiftStreamModal({ onClose }: GiftStreamModalProps) {
  const { address } = useWallet();
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const [step, setStep] = useState<GiftStep>("form");
  const [result, setResult] = useState<GiftResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [recipient, setRecipient] = useState("");
  const [token, setToken] = useState<string>("USDC");
  const [amount, setAmount] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(30 * 86400);
  const [customDuration, setCustomDuration] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [errors, setErrors] = useState({ recipient: "", amount: "" });

  const effectiveDuration =
    customDuration && parseInt(customDuration, 10) > 0
      ? parseInt(customDuration, 10) * 86400
      : durationSeconds;

  function validate(): boolean {
    const recipientErr = validateStellarAddress(recipient);
    let amountErr = "";
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      amountErr = "Amount must be greater than 0.";
    }
    setErrors({ recipient: recipientErr, amount: amountErr });
    return !recipientErr && !amountErr;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Sender must not be the recipient
    if (address && recipient === address) {
      setErrors((prev) => ({ ...prev, recipient: "Recipient cannot be the same as the sender." }));
      return;
    }

    setStep("confirming");
    try {
      const { streamId } = await sorostream.createStream({
        recipient,
        amount,
        durationSeconds: effectiveDuration,
        token,
      });

      // Persist gift message in localStorage (keyed by stream ID)
      if (giftMessage.trim()) {
        saveGiftMessage(streamId, giftMessage.trim());
      }

      const shareUrl = `${window.location.origin}/stream/${streamId}`;
      setResult({ streamId, shareUrl });
      setStep("done");
    } catch {
      addToast("Failed to create gift stream. Please try again.", "error");
      setStep("form");
    }
  }

  function handleCopyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.shareUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2500); },
      () => { addToast("Could not copy — please copy the URL manually.", "error"); },
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 overflow-y-auto py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-modal-title"
        className="bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="gift-modal-title" className="text-lg font-semibold text-white flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl">🎁</span>
            Gift a Stream
          </h2>
          <button
            onClick={onClose}
            aria-label="Close gift stream dialog"
            className="text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Step: Form ─────────────────────────────────────────────── */}
        {step === "form" && (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Recipient */}
            <div>
              <label htmlFor="gift-recipient" className="block text-sm text-gray-300 mb-1">
                Recipient address <span className="text-red-400">*</span>
              </label>
              <input
                id="gift-recipient"
                type="text"
                value={recipient}
                onChange={(e) => { setRecipient(e.target.value); setErrors((p) => ({ ...p, recipient: "" })); }}
                onBlur={() => setErrors((p) => ({ ...p, recipient: validateStellarAddress(recipient) }))}
                placeholder="G… (56-character Stellar address)"
                className={`w-full bg-gray-700 border rounded-lg px-4 py-2.5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 placeholder-gray-500 ${
                  errors.recipient ? "border-red-500" : "border-gray-600"
                }`}
                aria-describedby={errors.recipient ? "gift-recipient-err" : undefined}
              />
              {errors.recipient && (
                <p id="gift-recipient-err" role="alert" className="text-red-400 text-xs mt-1">{errors.recipient}</p>
              )}
            </div>

            {/* Token */}
            <div>
              <label htmlFor="gift-token" className="block text-sm text-gray-300 mb-1">Token</label>
              <select
                id="gift-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                {SUPPORTED_TOKENS.map((t) => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol} — {t.name}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="gift-amount" className="block text-sm text-gray-300 mb-1">
                Total amount ({token}) <span className="text-red-400">*</span>
              </label>
              <input
                id="gift-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: "" })); }}
                placeholder="e.g. 100"
                className={`w-full bg-gray-700 border rounded-lg px-4 py-2.5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 placeholder-gray-500 ${
                  errors.amount ? "border-red-500" : "border-gray-600"
                }`}
                aria-describedby={errors.amount ? "gift-amount-err" : undefined}
              />
              {errors.amount && (
                <p id="gift-amount-err" role="alert" className="text-red-400 text-xs mt-1">{errors.amount}</p>
              )}
            </div>

            {/* Unlock duration */}
            <div>
              <p className="text-sm text-gray-300 mb-2">Unlock duration</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => { setDurationSeconds(p.seconds); setCustomDuration(""); }}
                    aria-pressed={durationSeconds === p.seconds && !customDuration}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                      durationSeconds === p.seconds && !customDuration
                        ? "bg-green-700 border-green-600 text-white"
                        : "border-gray-600 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Custom (days)"
                  className="w-36 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 placeholder-gray-500"
                  aria-label="Custom duration in days"
                />
                <span className="text-gray-400 text-sm">days</span>
              </div>
            </div>

            {/* Gift message */}
            <div>
              <label htmlFor="gift-message" className="block text-sm text-gray-300 mb-1">
                Gift message <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                id="gift-message"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Write a personal note to the recipient…"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 placeholder-gray-500 resize-none"
              />
              <p className="text-gray-500 text-xs mt-1 text-right">{giftMessage.length}/280</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-600 text-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 flex items-center justify-center gap-2"
              >
                <span aria-hidden="true">🎁</span>
                Send Gift
              </button>
            </div>
          </form>
        )}

        {/* ── Step: Confirming ─────────────────────────────────────── */}
        {step === "confirming" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <svg
              className="animate-spin h-10 w-10 text-green-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-white text-sm">Creating gift stream…</p>
          </div>
        )}

        {/* ── Step: Done ───────────────────────────────────────────── */}
        {step === "done" && result && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-5xl" aria-hidden="true">🎉</div>
              <h3 className="text-white font-semibold text-lg text-center">Gift stream created!</h3>
              <p className="text-gray-400 text-sm text-center">
                Stream <span className="text-white font-mono">#{result.streamId}</span> is ready for your recipient.
                Share the link below so they can claim their gift.
              </p>
            </div>

            {/* Shareable link */}
            <div>
              <p className="text-gray-300 text-sm font-medium mb-2">Shareable gift link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={result.shareUrl}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                  aria-label="Shareable gift link"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                    copied
                      ? "bg-green-800 text-green-300"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href={result.shareUrl}
                className="flex-1 text-center bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                View Gift Stream
              </a>
              <button
                onClick={onClose}
                className="flex-1 border border-gray-600 text-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
