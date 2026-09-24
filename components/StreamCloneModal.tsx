"use client";

import { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFocusTrap } from "@/src/lib/useFocusTrap";
import type { StreamData } from "@/src/lib/sorostream";

interface StreamCloneModalProps {
  stream: StreamData;
  onClose: () => void;
}

/** Human-readable duration from seconds. */
function formatDuration(seconds: number): string {
  if (seconds >= 86400) {
    const d = Math.floor(seconds / 86400);
    return `${d} day${d !== 1 ? "s" : ""}`;
  }
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h !== 1 ? "s" : ""}`;
  }
  const m = Math.floor(seconds / 60);
  return `${m} minute${m !== 1 ? "s" : ""}`;
}

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function StreamCloneModal({ stream, onClose }: StreamCloneModalProps) {
  const router = useRouter();
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

  const durationSeconds = Math.round(
    (new Date(stream.endTime).getTime() - new Date(stream.startTime).getTime()) / 1000,
  );
  const amountToken = (stream.deposit / 10_000_000).toFixed(2);

  function handleClone() {
    const qp = new URLSearchParams({
      recipient: stream.recipient,
      amount: amountToken,
      token: stream.token,
      duration: String(durationSeconds),
      cliff: "0",
    });
    router.push(`/stream/new?${qp.toString()}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-modal-title"
        className="bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="clone-modal-title" className="text-lg font-semibold text-white flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-green-400"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Clone Stream #{stream.id}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close clone dialog"
            className="text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400">
          The create-stream form will be pre-filled with the parameters below. You can edit any field before submitting. Start time will default to <span className="text-white font-medium">now</span>.
        </p>

        {/* Parameter preview */}
        <div className="bg-gray-900 rounded-lg divide-y divide-gray-700 text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-gray-400">Recipient</span>
            <span className="text-white font-mono" title={stream.recipient}>{truncate(stream.recipient)}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-gray-400">Token</span>
            <span className="text-white font-medium">{stream.token}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-gray-400">Total amount</span>
            <span className="text-white font-mono">{amountToken} {stream.token}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-gray-400">Duration</span>
            <span className="text-white">{formatDuration(durationSeconds)}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-gray-400">Start time</span>
            <span className="text-green-400 font-medium">Now (today)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-600 text-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Clone Stream
          </button>
        </div>
      </div>
    </div>
  );
}
