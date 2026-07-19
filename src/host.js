// @ts-check
import { evaluate } from './guard.js';
import { wrapUntrusted } from './untrusted.js';
import { ToolRegistry } from './registry.js';

/** @typedef {import('./types.js').Model} Model */
/** @typedef {import('./types.js').Policy} Policy */
/** @typedef {import('./types.js').Message} Message */
/** @typedef {import('./types.js').TraceEvent} TraceEvent */
/** @typedef {import('./types.js').Tool} Tool */

/**
 * The tool-use loop. The model proposes; the guard disposes. Crucially, the
 * model NEVER acts directly — every proposed tool call is checked by the guard
 * before anything runs, and untrusted tool output is wrapped before it re-enters
 * the transcript. A blocked call is fed back as a system note so the model can
 * recover, and the loop is bounded by maxSteps.
 */
export class Host {
  /**
   * @param {{ model: Model, registry: ToolRegistry, policy: Policy, maxSteps?: number }} opts
   */
  constructor({ model, registry, policy, maxSteps = 8 }) {
    this.model = model;
    this.registry = registry;
    this.policy = policy;
    this.maxSteps = maxSteps;
  }

  /**
   * Run one user turn to completion.
   * @param {string} userInput
   * @returns {Promise<{ text: string, trace: TraceEvent[], executed: string[] }>}
   */
  async handle(userInput) {
    /** @type {Message[]} */
    const transcript = [{ role: 'user', content: userInput }];
    /** @type {TraceEvent[]} */
    const trace = [];
    /** @type {string[]} */
    const executed = [];

    for (let step = 1; step <= this.maxSteps; step++) {
      const proposal = await this.model.next(transcript);

      if (proposal.kind === 'final') {
        trace.push({ step, kind: 'final' });
        return { text: proposal.text, trace, executed };
      }

      const tool = this.registry.get(proposal.call.tool);
      const verdict = evaluate(proposal.call, tool, this.policy);

      if (!verdict.allowed) {
        trace.push({ step, kind: 'blocked', tool: proposal.call.tool, reason: verdict.reason });
        transcript.push({ role: 'system', content: `tool "${proposal.call.tool}" refused: ${verdict.reason}` });
        continue;
      }

      // `tool` is defined here because evaluate() returned allowed.
      const result = await /** @type {Tool} */ (tool).run(proposal.call.args);
      executed.push(proposal.call.tool);
      trace.push({ step, kind: 'ran', tool: proposal.call.tool });

      const content = result.untrusted ? wrapUntrusted(result.content) : result.content;
      transcript.push({ role: 'tool', content });
    }

    return { text: '[stopped: max steps reached]', trace, executed };
  }
}
