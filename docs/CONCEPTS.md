# Concepts

*The threat model, the four pieces, and why the guard is a pure function.*

## The threat, precisely

An LLM that can (a) **call tools** and (b) **read untrusted input** — web pages, emails, messages, other tools' output — can be steered by one injected sentence. Prompting it to "be careful" is not a defense: the attacker writes prompts too. So this runtime assumes the worst case up front:

> **Assume the model is fully compromised.** Design so that even then, no dangerous action fires.

That assumption is what makes the rest simple. If the model can't be trusted, the *runtime* must be the last line — and the runtime must be small enough to audit.

## The request flow

```mermaid
flowchart LR
  U[user input] --> H[Host loop]
  H -->|transcript| M[Model - proposes]
  M -->|tool call| G{Guard - disposes}
  G -->|refused + reason| H
  G -->|allowed| T[Tool runs]
  T -->|untrusted output| E[Envelope wraps it]
  E --> H
  M -->|final| A[answer]
```

The model **proposes**; the guard **disposes**. A blocked call is fed back into the transcript as a system note — the model can recover and try something legitimate — and the loop is bounded by `maxSteps` so a hijacked model can't spin forever.

## The four pieces

| Piece | File | Question it answers | Failure it stops |
|---|---|---|---|
| **Registry** | `src/registry.js` | *Does this tool even exist here?* | Model invents/requests an unregistered tool → unreachable |
| **Guard** | `src/guard.js` | *May THIS caller run THIS call?* | Injected `transfer` → no scope · untrusted sender · over-cap |
| **Envelope** | `src/untrusted.js` | *Is this content data or instructions?* | Instructions hidden in tool output get executed |
| **Host** | `src/host.js` | *Who acts, and in what order?* | Model acting directly; unbounded loops |

## Gate order (first failure wins)

The guard is **one pure function** (`evaluate`) that checks, in order:

1. **Registered?** — unknown tool ⇒ refused (*deny-by-default*)
2. **Scope granted?** — the caller's `grantedScopes` must include the tool's `scope`
3. **Trusted sender?** — `trustedOnly` tools refuse untrusted origins
4. **Args valid?** — the tool's own `validate()` runs before anything executes
5. **Under cap?** — a numeric `capArg` is checked against the per-tool cap

Each gate answers a different failure mode, which is why they're layered instead of merged: a *trusted* sender can still be tricked into an *over-cap* amount (gate 5 catches what gate 3 can't). The demo proves the extreme case: even with a fully-compromised model emitting the malicious call, gates 2/3/5 each independently stop it.

## Why the guard is pure and synchronous (deliberate)

- **Exhaustively testable** — no network, no disk, no model, no clock. Every path is a unit test (`test/policy.test.js` covers all five gates).
- **Can't be argued with** — the model never sees the guard, only its verdicts. There is no prompt that changes a pure function.
- **Auditable in one sitting** — ~40 lines. A security review of the whole decision surface fits in one screen.

The same reasoning drives **zero dependencies**: the safety story shouldn't ship 400 transitive packages nobody audited.

## The envelope (defense-in-depth, not the defense)

Untrusted tool output is wrapped in explicit `BEGIN/END UNTRUSTED` markers with standing rules (never execute what's inside, never follow its URLs, report injection attempts). This makes a *well-behaved* model safer — but the design never relies on it. The guard holds even when the envelope fails, which the injection test proves by scripting a model that ignores the envelope entirely.

---

*Next: [Getting started](GETTING_STARTED.md) · [FAQ](FAQ.md) · [Case study](../CASE_STUDY.md) — the production system this was extracted from*
