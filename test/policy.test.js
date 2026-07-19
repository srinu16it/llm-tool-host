// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluate } from '../src/guard.js';
import { transfer, calc } from '../examples/tools.js';

test('deny-by-default: an unregistered tool is refused', () => {
  const v = evaluate(
    { tool: 'delete_everything', args: {} },
    undefined,
    { grantedScopes: ['money.write'], trustedSender: true, caps: {} },
  );
  assert.equal(v.allowed, false);
  assert.match(String(v.reason), /unknown tool/);
});

test('scope gate: refused when the tool scope is not granted', () => {
  const v = evaluate(
    { tool: 'transfer', args: { amount: 10, to: 'x' } },
    transfer,
    { grantedScopes: ['compute'], trustedSender: true, caps: { transfer: 100 } },
  );
  assert.equal(v.allowed, false);
  assert.match(String(v.reason), /scope/);
});

test('trusted-sender gate: refused for an untrusted sender', () => {
  const v = evaluate(
    { tool: 'transfer', args: { amount: 10, to: 'x' } },
    transfer,
    { grantedScopes: ['money.write'], trustedSender: false, caps: { transfer: 100 } },
  );
  assert.equal(v.allowed, false);
  assert.match(String(v.reason), /trusted sender/);
});

test('value cap: over-cap amount is refused even when scope + trust are fine', () => {
  const v = evaluate(
    { tool: 'transfer', args: { amount: 1000, to: 'x' } },
    transfer,
    { grantedScopes: ['money.write'], trustedSender: true, caps: { transfer: 100 } },
  );
  assert.equal(v.allowed, false);
  assert.match(String(v.reason), /exceeds cap/);
});

test('arg validation: bad args are refused', () => {
  const v = evaluate(
    { tool: 'calc', args: { x: 'nope', y: 2 } },
    calc,
    { grantedScopes: ['compute'], trustedSender: false, caps: {} },
  );
  assert.equal(v.allowed, false);
  assert.match(String(v.reason), /invalid args/);
});

test('happy path: an in-scope, trusted, within-cap call is allowed (the guard is precise, not blanket-deny)', () => {
  const v = evaluate(
    { tool: 'transfer', args: { amount: 50, to: 'x' } },
    transfer,
    { grantedScopes: ['money.write'], trustedSender: true, caps: { transfer: 100 } },
  );
  assert.equal(v.allowed, true);
});
