// @ts-check
// Shared types (JSDoc). Zero runtime cost — kept in one place so the whole
// contract is readable at a glance.

/**
 * @typedef {{ content: string, untrusted?: boolean }} ToolResult
 *   A tool's return. `untrusted: true` means the content came from outside the
 *   system (a web page, an email, a message) and must be treated as DATA.
 *
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {string} scope           - capability this tool needs (e.g. "money.write")
 * @property {boolean} [trustedOnly]   - if true, only a trusted sender may invoke it
 * @property {string} [capArg]         - name of a numeric arg to cap (e.g. "amount")
 * @property {(args: Record<string, unknown>) => (string|null)} [validate] - return a reason to reject, or null
 * @property {(args: Record<string, unknown>) => (ToolResult | Promise<ToolResult>)} run
 *
 * @typedef {{ tool: string, args: Record<string, unknown> }} ToolCall
 * @typedef {{ kind: 'tool', call: ToolCall } | { kind: 'final', text: string }} ModelStep
 * @typedef {{ role: 'user'|'assistant'|'tool'|'system', content: string }} Message
 * @typedef {{ next: (transcript: Message[]) => (ModelStep | Promise<ModelStep>) }} Model
 *
 * @typedef {Object} Policy
 * @property {string[]} grantedScopes  - scopes this caller is allowed to use
 * @property {boolean} trustedSender   - is the request from a trusted origin?
 * @property {Record<string, number>} caps - per-tool numeric caps, keyed by tool name
 *
 * @typedef {{ step: number, kind: 'ran'|'blocked'|'final', tool?: string, reason?: string }} TraceEvent
 */

export {};
