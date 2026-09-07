import type { Meta, StoryObj } from "@storybook/react";
import FeeEstimationPanel from "@/components/FeeEstimationPanel";

/**
 * FeeEstimationPanel stories.
 *
 * The component's only public prop is `active: boolean`.
 * When active=true it fires a simulated Soroban RPC call (~800–1200 ms)
 * and self-transitions through loading → success (or error).
 *
 * - **Active (loading → success)**: Set active=true and watch it resolve.
 * - **Inactive**: Set active=false — the panel renders nothing.
 *
 * Because the component manages its own async state internally, each story
 * shows a "live" panel that transitions on its own after ~1 second.
 * Use the Controls addon to toggle `active` on/off to restart the simulation.
 */
const meta: Meta<typeof FeeEstimationPanel> = {
  title: "UI/FeeEstimationPanel",
  component: FeeEstimationPanel,
  argTypes: {
    active: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj<typeof FeeEstimationPanel>;

/**
 * Panel is active: starts in the loading skeleton state, then resolves to
 * the success state showing a real simulated fee breakdown after ~1 s.
 */
export const Active: Story = {
  args: {
    active: true,
  },
};

/**
 * Panel is inactive — renders nothing (returns null).
 * Demonstrates the no-render guard.
 */
export const Inactive: Story = {
  args: {
    active: false,
  },
};

/**
 * Demonstrates the loading skeleton in isolation.
 *
 * Because the real async call is fast (~1 s), this story forces a fresh mount
 * each render via a `key` on the Story decorator so the skeleton is always
 * visible for at least the simulation window.
 */
export const Loading: Story = {
  args: {
    active: true,
  },
  // Force a remount each time the story is selected so the skeleton is visible.
  decorators: [
    (Story) => <Story key={Date.now()} />,
  ],
};

/**
 * Error state: shown when the simulated RPC call rejects.
 *
 * This story monkey-patches the module export so that
 * `simulateTransactionFee` always throws, then renders the panel.
 * After the story, the original is restored automatically via the decorator.
 */
export const Error: Story = {
  args: {
    active: true,
  },
  decorators: [
    (Story) => {
      // Dynamically override the exported function so this story always
      // lands in the error branch.
      const mod = require("@/src/lib/sorostream") as {
        simulateTransactionFee: () => Promise<unknown>;
      };
      const original = mod.simulateTransactionFee;
      mod.simulateTransactionFee = () => Promise.reject(new Error("Simulated RPC failure"));
      // Restore after a tick so subsequent stories are unaffected.
      Promise.resolve().then(() => {
        mod.simulateTransactionFee = original;
      });
      return <Story key="error-state" />;
    },
  ],
};
