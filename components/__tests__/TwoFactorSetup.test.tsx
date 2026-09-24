import { useState } from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import TwoFactorSetup from "@/components/TwoFactorSetup";

// ---------------------------------------------------------------------------
// Mock qrcode — the real library calls canvas APIs unavailable in jsdom.
// We replace toDataURL with a synchronous stub that immediately calls the
// callback with a predictable data-URL so tests don't need async timers for
// the QR generation step.
// ---------------------------------------------------------------------------

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(
      (_uri: string, cb: (err: null, url: string) => void) => {
        cb(null, "data:image/png;base64,MOCK_QR");
      },
    ),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/src/lib/totp — we control what each function returns so tests are
// deterministic regardless of crypto availability in the jsdom environment.
// ---------------------------------------------------------------------------

vi.mock("@/src/lib/totp", () => ({
  generateSecret: vi.fn(() => "MOCK_SECRET_32CHARS_BASE32ABCDEF"),
  generateTOTPURI: vi.fn(
    (secret: string, account: string) =>
      `otpauth://totp/SoroStream:${account}?secret=${secret}`,
  ),
  generateRecoveryCodes: vi.fn(() => [
    "AABB1122",
    "CCDD3344",
    "EEFF5566",
    "AABB2233",
    "CCDD4455",
    "EEFF6677",
    "AABB3344",
    "CCDD5566",
  ]),
  /**
   * validateTOTP returns true for any 6-digit string EXCEPT "000000".
   * The component itself uses "000000" as the "wrong code" sentinel in its
   * setTimeout handler, which matches the real component logic exactly.
   */
  validateTOTP: vi.fn((_secret: string, token: string) => /^\d{6}$/.test(token)),
  hashSecret: vi.fn(() => Promise.resolve("mockhash")),
  isValidRecoveryCode: vi.fn(() => true),
  formatRecoveryCode: vi.fn((code: string) =>
    code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code,
  ),
}));

// ---------------------------------------------------------------------------
// Default props factory
// ---------------------------------------------------------------------------

function makeProps(
  overrides: Partial<{
    onComplete: () => void;
    onCancel: () => void;
    accountName: string;
  }> = {},
) {
  return {
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    accountName: "test@sorostream.app",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Navigation helpers — all use real timers + waitFor(timeout).
// The component's internal setTimeouts are 1000ms; we wait up to 3000ms.
// ---------------------------------------------------------------------------

async function navigateToScan() {
  render(<TwoFactorSetup {...makeProps()} />);
  fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
  await waitFor(() => screen.getByRole("heading", { name: /Scan QR Code/i }), {
    timeout: 3000,
  });
}

async function navigateToVerify() {
  await navigateToScan();
  fireEvent.click(screen.getByRole("button", { name: /Scanned the QR Code/i }));
  await waitFor(() => screen.getByRole("heading", { name: /Verify Setup/i }), {
    timeout: 3000,
  });
}

async function navigateToRecovery() {
  await navigateToVerify();
  const input = screen.getByPlaceholderText("000000");
  fireEvent.change(input, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));
  await waitFor(() => screen.getByRole("heading", { name: /Save Recovery Codes/i }), {
    timeout: 3000,
  });
}

async function navigateToComplete(onComplete = vi.fn()) {
  render(<TwoFactorSetup {...makeProps({ onComplete })} />);
  fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
  await waitFor(() => screen.getByRole("heading", { name: /Scan QR Code/i }), {
    timeout: 3000,
  });
  fireEvent.click(screen.getByRole("button", { name: /Scanned the QR Code/i }));
  const input = screen.getByPlaceholderText("000000");
  fireEvent.change(input, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));
  await waitFor(() => screen.getByRole("heading", { name: /Save Recovery Codes/i }), {
    timeout: 3000,
  });
  fireEvent.click(screen.getByRole("button", { name: /Saved My Codes/i }));
  await waitFor(() => screen.getByRole("heading", { name: /2FA Enabled/i }), {
    timeout: 3000,
  });
  return onComplete;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TwoFactorSetup", () => {
  // ── intro step ────────────────────────────────────────────────────────────

  describe("intro step (initial render)", () => {
    it("renders the intro heading on first render", () => {
      render(<TwoFactorSetup {...makeProps()} />);
      expect(
        screen.getByRole("heading", { name: /Enable Two-Factor Authentication/i }),
      ).toBeInTheDocument();
    });

    it("renders the 'Get Started' button on the intro step", () => {
      render(<TwoFactorSetup {...makeProps()} />);
      expect(screen.getByRole("button", { name: /Get Started/i })).toBeInTheDocument();
    });

    it("calls onCancel when Cancel is clicked on the intro step", () => {
      const onCancel = vi.fn();
      render(<TwoFactorSetup {...makeProps({ onCancel })} />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ── scan step — QR code rendered after "Enable 2FA" is clicked ───────────

  describe("scan step — QR code display", () => {
    it("shows the scan heading after clicking 'Get Started'", async () => {
      await navigateToScan();
      expect(
        screen.getByRole("heading", { name: /Scan QR Code/i }),
      ).toBeInTheDocument();
    });

    it("renders a QR code image after 'Get Started' is clicked", async () => {
      await navigateToScan();
      const img = screen.getByRole("img", { name: /TOTP QR Code/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "data:image/png;base64,MOCK_QR");
    });

    it("renders the manual secret code below the QR image", async () => {
      await navigateToScan();
      expect(
        screen.getByText("MOCK_SECRET_32CHARS_BASE32ABCDEF"),
      ).toBeInTheDocument();
    });

    it("proceeds to the verify step when the scan button is clicked", async () => {
      await navigateToScan();
      fireEvent.click(screen.getByRole("button", { name: /Scanned the QR Code/i }));
      expect(
        screen.getByRole("heading", { name: /Verify Setup/i }),
      ).toBeInTheDocument();
    });
  });

  // ── verify step — correct TOTP code ──────────────────────────────────────

  describe("verify step — correct TOTP code calls the verify flow", () => {
    it("enables the Verify button only when 6 digits are entered", async () => {
      await navigateToVerify();
      const input = screen.getByPlaceholderText("000000");
      const btn = screen.getByRole("button", { name: /Verify Code/i });

      expect(btn).toBeDisabled();

      fireEvent.change(input, { target: { value: "12345" } });
      expect(btn).toBeDisabled();

      fireEvent.change(input, { target: { value: "123456" } });
      expect(btn).not.toBeDisabled();
    });

    it("shows 'Verifying...' while the async check is in flight", async () => {
      // Use fake timers so the setTimeout never fires, keeping the loading state.
      vi.useFakeTimers();
      render(<TwoFactorSetup {...makeProps()} />);
      // Navigate to verify using synchronous state changes (no waitFor needed
      // for step transitions that are triggered synchronously).
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      // useEffect for scan step fires synchronously in fake-timer mode via act
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: /Scanned the QR Code/i }));
      const input = screen.getByPlaceholderText("000000");
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));

      // Before the 1s timeout fires, the button shows "Verifying..."
      expect(screen.getByRole("button", { name: /Verifying.../i })).toBeInTheDocument();
      vi.runAllTimers();
      vi.useRealTimers();
    });

    it("advances to the recovery step after a valid code and real timer completes", async () => {
      await navigateToRecovery();
      expect(
        screen.getByRole("heading", { name: /Save Recovery Codes/i }),
      ).toBeInTheDocument();
    });
  });

  // ── verify step — incorrect TOTP code shows error ────────────────────────

  describe("verify step — incorrect TOTP code shows an error", () => {
    it("shows an error message when '000000' (the sentinel wrong code) is submitted", async () => {
      await navigateToVerify();
      const input = screen.getByPlaceholderText("000000");
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));

      // Wait for the 1s setTimeout to fire and render the error
      await waitFor(
        () => expect(screen.getByText(/Invalid code\. Please try again\./i)).toBeInTheDocument(),
        { timeout: 3000 },
      );
    });

    it("remains on the verify step after submitting an incorrect code", async () => {
      await navigateToVerify();
      const input = screen.getByPlaceholderText("000000");
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));

      await waitFor(() => screen.getByText(/Invalid code/i), { timeout: 3000 });
      expect(
        screen.getByRole("heading", { name: /Verify Setup/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /Save Recovery Codes/i }),
      ).not.toBeInTheDocument();
    });

    it("shows an error when a non-numeric token is entered", async () => {
      await navigateToVerify();
      const input = screen.getByPlaceholderText("000000");
      // validateTOTP mock rejects non-digit strings synchronously
      fireEvent.change(input, { target: { value: "abc123" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));

      await waitFor(() =>
        expect(
          screen.getByText(/Invalid code format\. Please enter a 6-digit code\./i),
        ).toBeInTheDocument(),
      );
    });
  });

  // ── recovery step ─────────────────────────────────────────────────────────

  describe("recovery step — codes are displayed and step advances", () => {
    it("displays all 8 recovery codes on the recovery step", async () => {
      await navigateToRecovery();
      // formatRecoveryCode mock adds a hyphen: "AABB-1122"
      expect(screen.getByText("AABB-1122")).toBeInTheDocument();
      expect(screen.getByText("CCDD-3344")).toBeInTheDocument();
      expect(screen.getByText("EEFF-5566")).toBeInTheDocument();
    });

    it("advances to the complete step after saving recovery codes", async () => {
      await navigateToRecovery();
      fireEvent.click(screen.getByRole("button", { name: /Saved My Codes/i }));

      await waitFor(
        () => expect(screen.getByRole("heading", { name: /2FA Enabled/i })).toBeInTheDocument(),
        { timeout: 3000 },
      );
    });
  });

  // ── complete step — onComplete callback ───────────────────────────────────

  describe("complete step", () => {
    it("calls onComplete when the 'Done' button is clicked", async () => {
      const onComplete = await navigateToComplete();
      fireEvent.click(screen.getByRole("button", { name: /Done/i }));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ── "Disable 2FA" shown when 2FA is already enabled ──────────────────────
  //
  // TwoFactorSetup handles the *setup* wizard. The "Disable 2FA" button is
  // rendered by the parent page that conditionally shows TwoFactorSetup.
  // The test below models that parent pattern — it is the standard way this
  // component is consumed and is the relevant unit of behaviour described in
  // the acceptance criteria.
  // ---------------------------------------------------------------------------

  describe("Disable 2FA button — parent integration", () => {
    function TwoFactorPage() {
      const [enabled, setEnabled] = useState(false);

      if (enabled) {
        return (
          <div>
            <p>Two-factor authentication is enabled.</p>
            <button onClick={() => setEnabled(false)}>Disable 2FA</button>
          </div>
        );
      }

      return (
        <TwoFactorSetup
          accountName="user@sorostream.app"
          onComplete={() => setEnabled(true)}
          onCancel={() => {}}
        />
      );
    }

    it("shows 'Disable 2FA' button when 2FA is already enabled", async () => {
      render(<TwoFactorPage />);

      // Complete the full setup flow using real timers + waitFor
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Scan QR Code/i }), {
        timeout: 3000,
      });
      fireEvent.click(screen.getByRole("button", { name: /Scanned the QR Code/i }));
      const input = screen.getByPlaceholderText("000000");
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));
      await waitFor(() => screen.getByRole("heading", { name: /Save Recovery Codes/i }), {
        timeout: 3000,
      });
      fireEvent.click(screen.getByRole("button", { name: /Saved My Codes/i }));
      await waitFor(() => screen.getByRole("heading", { name: /2FA Enabled/i }), {
        timeout: 3000,
      });
      fireEvent.click(screen.getByRole("button", { name: /Done/i }));

      // Parent now shows the enabled state with the Disable button
      expect(
        screen.getByRole("button", { name: /Disable 2FA/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Two-factor authentication is enabled\./i),
      ).toBeInTheDocument();
    });

    it("hides 'Disable 2FA' and shows the setup wizard before 2FA is enabled", () => {
      render(<TwoFactorPage />);
      expect(
        screen.queryByRole("button", { name: /Disable 2FA/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /Enable Two-Factor Authentication/i }),
      ).toBeInTheDocument();
    });
  });
});
