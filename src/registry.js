// @ts-check
/** @typedef {import('./types.js').Tool} Tool */

/**
 * Deny-by-default tool registry. A tool the model asks for that was never
 * registered simply does not resolve — the host then refuses the call. New
 * capabilities are opt-in; nothing is reachable by accident.
 */
export class ToolRegistry {
  /** @type {Map<string, Tool>} */
  #tools = new Map();

  /** @param {Tool} tool @returns {this} */
  register(tool) {
    if (this.#tools.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
    this.#tools.set(tool.name, tool);
    return this;
  }

  /** @param {string} name @returns {Tool | undefined} */
  get(name) {
    return this.#tools.get(name);
  }

  /** @returns {string[]} */
  names() {
    return [...this.#tools.keys()];
  }
}
