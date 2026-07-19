// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { Host } from '../src/host.js';
import { ToolRegistry } from '../src/registry.js';
import { scriptedModel } from '../examples/mockModel.js';
import { fetchPage, transfer, calc, echo } from '../examples/tools.js';
import { wrapUntrusted, UNTRUSTED_BEGIN, UNTRUSTED_END } from '../src/untrusted.js';

const registry = () =>
  new ToolRegistry().register(fetchPage).register(transfer).register(calc).register(echo);

test('a fully-compromised model cannot move money via injected page content', async () => {
  const model = scriptedModel([
    { kind: 'tool', call: { tool: 'fetchPage', args: { url: 'http://news.example' } } }, // returns injection
    { kind: 'tool', call: { tool: 'transfer', args: { amount: 1_000_000, to: 'EVIL' } } }, // the hijacked action
    { kind: 'final', text: 'summarized the news' },
  ]);
  const policy = { grantedScopes: ['web.read', 'compute'], trustedSender: false, caps: { transfer: 100 } };

  const out = await new Host({ model, registry: registry(), policy }).handle('summarize the news');

  assert.ok(!out.executed.includes('transfer'), 'transfer must never execute');
  assert.ok(
    out.trace.some((t) => t.kind === 'blocked' && t.tool === 'transfer'),
    'transfer should be explicitly blocked',
  );
});

test('defense-in-depth: even a TRUSTED sender is stopped by the value cap', async () => {
  const model = scriptedModel([
    { kind: 'tool', call: { tool: 'transfer', args: { amount: 1_000_000, to: 'EVIL' } } },
    { kind: 'final', text: 'done' },
  ]);
  const policy = { grantedScopes: ['money.write'], trustedSender: true, caps: { transfer: 100 } };

  const out = await new Host({ model, registry: registry(), policy }).handle('pay the invoice');

  assert.ok(!out.executed.includes('transfer'));
  const blocked = out.trace.find((t) => t.kind === 'blocked' && t.tool === 'transfer');
  assert.ok(blocked);
  assert.match(String(blocked.reason), /exceeds cap/);
});

test('untrusted tool output is wrapped in explicit markers', () => {
  const wrapped = wrapUntrusted('hello <injection here>');
  assert.ok(wrapped.startsWith(UNTRUSTED_BEGIN));
  assert.ok(wrapped.trimEnd().endsWith(UNTRUSTED_END));
  assert.match(wrapped, /\[rules\]/);
});

test('benign path still works end-to-end', async () => {
  const model = scriptedModel([
    { kind: 'tool', call: { tool: 'calc', args: { x: 2, y: 3 } } },
    { kind: 'final', text: 'the answer is 5' },
  ]);
  const policy = { grantedScopes: ['compute'], trustedSender: false, caps: {} };

  const out = await new Host({ model, registry: registry(), policy }).handle('add 2 and 3');

  assert.deepEqual(out.executed, ['calc']);
  assert.equal(out.text, 'the answer is 5');
});
