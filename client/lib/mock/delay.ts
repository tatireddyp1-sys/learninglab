/**
 * Configurable artificial latency so the UI shows realistic loading states.
 * Set MOCK_DELAY_MS to 0 during tests or development to speed things up.
 */

let MOCK_DELAY_MS = { min: 200, max: 600 };

export function configureMockDelay(range: { min: number; max: number }) {
  MOCK_DELAY_MS = range;
}

export function delay(): Promise<void> {
  const ms = MOCK_DELAY_MS.min + Math.random() * (MOCK_DELAY_MS.max - MOCK_DELAY_MS.min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
