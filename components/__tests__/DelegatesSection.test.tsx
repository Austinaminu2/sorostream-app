import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import DelegatesSection from "../DelegatesSection";

const STORAGE_KEY = "sorostream-delegates";

const ADDR_A = "GB7TJKR6KZ3L3LYPZNAZQJR4HGLJ4E7MSTFJZXQZ2RL4QJKZKSX6JQJ5";
const ADDR_B = "GCZEAELPDHRCOS7XZAFAQ7TMURYCMDH5GB6MLCO4KDYK3AS3HFEIY2EZ";

function storedDelegates() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as Array<{
    address: string;
    addedAt: string;
    streamIds: string[];
  }>;
}

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });

describe("DelegatesSection", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty list by default", () => {
    render(<DelegatesSection />);

    expect(screen.getByText("No delegates added yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(storedDelegates()).toEqual([]);
  });

  it("appends a valid Stellar address when added", async () => {
    render(<DelegatesSection />);

    const input = screen.getByLabelText("Delegate Address");
    fireEvent.change(input, { target: { value: ADDR_A } });
    fireEvent.click(screen.getByRole("button", { name: "Add Delegate" }));

    await waitFor(() => {
      expect(screen.getByText(/GB7TJK…JQJ5/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText("Can manage all streams")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(storedDelegates()).toHaveLength(1);
    expect(storedDelegates()[0].address).toBe(ADDR_A);
  });

  it("shows a validation error when an invalid address is added", async () => {
    render(<DelegatesSection />);

    const input = screen.getByLabelText("Delegate Address");
    fireEvent.change(input, { target: { value: "G123" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Delegate" }));

    expect(await screen.findByText(/must be a valid stellar public key/i)).toBeInTheDocument();
    expect(screen.getByText("No delegates added yet.")).toBeInTheDocument();
    expect(storedDelegates()).toEqual([]);
  });

  it("removes only the selected delegate", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { address: ADDR_A, addedAt: "2026-01-01T00:00:00.000Z", streamIds: [] },
        { address: ADDR_B, addedAt: "2026-01-02T00:00:00.000Z", streamIds: [] },
      ]),
    );

    render(<DelegatesSection />);

    expect(screen.getByText(/GB7TJK…JQJ5/i)).toBeInTheDocument();
    expect(screen.getByText(/GCZEAE…Y2EZ/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Revoke delegate ${ADDR_A}` }));

    expect(screen.queryByText(/GB7TJK…JQJ5/i)).not.toBeInTheDocument();
    expect(screen.getByText(/GCZEAE…Y2EZ/i)).toBeInTheDocument();

    const saved = storedDelegates();
    expect(saved).toHaveLength(1);
    expect(saved[0].address).toBe(ADDR_B);
  });
});