// @ts-check
// A scripted stand-in for a real model, so the harness runs offline with no API
// key. Swap in a real adapter (Anthropic / OpenAI tool-use) behind the same
// `Model` interface — the host and guard don't change.

/** @typedef {import('../src/types.js').Model} Model */
/** @typedef {import('../src/types.js').ModelStep} ModelStep */

/**
 * A model that plays a fixed sequence of steps regardless of the transcript.
 * Useful for simulating a naive OR fully-compromised model in tests.
 * @param {ModelStep[]} steps
 * @returns {Model}
 */
export function scriptedModel(steps) {
  let i = 0;
  return {
    next: () => steps[i++] ?? { kind: 'final', text: 'done' },
  };
}
