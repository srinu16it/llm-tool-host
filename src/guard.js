// @ts-check
/** @typedef {import('./types.js').Tool} Tool */
/** @typedef {import('./types.js').ToolCall} ToolCall */
/** @typedef {import('./types.js').Policy} Policy */

/**
 * The entire safety argument in one pure function.
 *
 * Deny-by-default: a call is allowed ONLY if it clears every gate, in order:
 *   1. the tool is registered (unknown tool => refused)
 *   2. its scope is granted to this caller
 *   3. trusted-sender requirement (if any) is met
 *   4. its arguments validate
 *   5. any numeric cap is respected
 *
 * Pure and synchronous on purpose: it is trivial to unit-test exhaustively,
 * and it never touches the network, disk, or the model.
 *
 * @param {ToolCall} call
 * @param {Tool | undefined} tool  the registered tool, or undefined if unknown
 * @param {Policy} policy
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function evaluate(call, tool, policy) {
  if (!tool) {
    return { allowed: false, reason: `unknown tool "${call.tool}" (deny-by-default)` };
  }
  if (!policy.grantedScopes.includes(tool.scope)) {
    return { allowed: false, reason: `scope "${tool.scope}" not granted` };
  }
  if (tool.trustedOnly && !policy.trustedSender) {
    return { allowed: false, reason: `tool "${tool.name}" requires a trusted sender` };
  }
  if (tool.validate) {
    const problem = tool.validate(call.args);
    if (problem) return { allowed: false, reason: `invalid args: ${problem}` };
  }
  if (tool.capArg && tool.name in policy.caps) {
    const value = Number(call.args[tool.capArg]);
    const cap = policy.caps[tool.name];
    if (!Number.isFinite(value)) {
      return { allowed: false, reason: `cap arg "${tool.capArg}" is not a number` };
    }
    if (value > cap) {
      return { allowed: false, reason: `${tool.capArg}=${value} exceeds cap ${cap}` };
    }
  }
  return { allowed: true };
}
