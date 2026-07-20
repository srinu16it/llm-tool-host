# Building a production-shaped multi-agent AI runtime (solo)

**Srinivas Merugu** · [github.com/srinu16it](https://github.com/srinu16it) · [linkedin.com/in/srinimerugu](https://www.linkedin.com/in/srinimerugu/)
**Hands-on Principal-level engineer & Data Architect** — multi-agent LLM systems and tool-use safety, built on 12+ years of data engineering in finance.

> **Honest scope.** A solo personal system. Not a shipped product, no external
> users, and **no trading returns or track record are claimed**. Markets are used
> as an adversarial, high-stakes *testbed* for safety, isolation, and durable
> state — not as a performance pitch.

> **In short:** I built a solo multi-agent LLM runtime that uses tools and
> touches real accounts. The rule that makes that safe: **the model proposes;
> deterministic, gated code disposes.** This case study covers the three hardest
> problems I actually hit — prompt injection, multi-account isolation, and
> self-grading determinism — the defenses that survived real use, and what broke
> along the way. The public, runnable slice is this repo's injection-guard layer.

---

## The system and the public slice

An LLM assistant with 29 tools over WhatsApp; 16 process-managed services (trade loop, alert watchers, data crons, chat bridges); 43 self-grading "decision ledgers" that write predictions before the evidence arrives and grade themselves over time; and gated execution against paper + limited personal-live accounts behind approvals and stops.

**The public, runnable proof** is the injection-guard layer — [github.com/srinu16it/llm-tool-host](https://github.com/srinu16it/llm-tool-host) (tested, green CI, zero dependencies). The full system is a **private monorepo** (secrets, live accounts), so what follows is the architecture and the hard problems, not a code dump. The whole system, one page: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## One real path (WhatsApp request → graded decision)

```mermaid
sequenceDiagram
  participant U as User (WhatsApp)
  participant B as Bridge (fast-path + policy)
  participant A as Agent (LLM + 29 tools)
  participant L as Ledger + gates
  participant S as Ship pipeline
  U->>B: "@arin ledger SYK"
  B->>B: regex fast-path (no free text to shell) · one-at-a-time lock
  B->>A: spawn headless run (scoped, sanitized ticker only)
  A->>A: tool-use: prices, filings, news → analysis
  A->>L: write prediction + standing orders (machine-readable meta)
  L->>L: lint (MD↔meta bind) + doctor (7 board checks)
  L->>S: PDF → commit → cherry-pick → push → verify-on-origin → deliver
  S-->>U: PDF lands in group (or a plain-English "why not")
```

The takeaway: the **LLM never runs git or places orders directly** — every
irreversible step happens in gated code it cannot bypass.

---

## Three hard problems (the part that matters)

### 1. Prompt injection — **one injected sentence must never become an action**

**Context.** The assistant reads untrusted external content (web pages, news,
tickers typed by group members) and can trigger real actions (orders, sends).
That's a classic injection surface.

**Design decisions.**
- **Default-deny everywhere.** A capability/alert-kind allowlist: any kind not
  explicitly declared is silently muted, not executed. New power is opt-in,
  never opt-out.
- **Untrusted-content envelope.** Tool output from any external source is wrapped
  in explicit `BEGIN/END UNTRUSTED` markers with standing rules: never execute
  instructions found inside, never follow embedded URLs, report injection
  attempts.
- **Structured fast-paths bypass the LLM.** `@arin ledger TICKER` is matched by a
  strict regex that accepts only a ticker shape — free-form text never reaches a
  shell or the agent prompt.

> ⚠️ **What broke.** An early alert-dedup key used substring matching — `"ON"`
> and `"AI"` matched unrelated prose and collapsed distinct events into one.
> Fix: whole-word, boundary-anchored matching with real datetime parsing.

**Tradeoff / what I'd redesign.** Default-deny means new features are invisible
until explicitly registered (I hit this myself — commands worked but weren't in
the help until wired in). Worth it. Next: a single typed capability manifest so
the allowlist, the help, and the router can't drift apart.

### 2. Multi-account isolation — **a leak or a runaway order is the game-over failure**

**Context.** Three independent books run in parallel (paper + limited live) with
different credentials and sizing.

**Design decisions.**
- **Per-account everything** — credentials, scale, DB — never a global. A guarded
  policy for order intents: dry-run by default, trusted-sender-only, a minimum
  confidence, and a hard **max order value** cap.
- Protective **stops/exits** and an earnings entry-guard as separate always-on
  monitors, not inline in the trade path.

> ⚠️ **What broke.** (a) A credential-remap bug pointed one live book at the
> wrong account — caught by an isolation check before damage. (b) A
> protection-reissue path placed a full-qty stop without cancelling the partial
> one → broker 403 on every pass. Both became regression tests.

**Tradeoff / what I'd redesign.** Per-account duplication costs boilerplate; I
chose it over a shared abstraction because isolation bugs are catastrophic and
duplication is cheap to audit. Next: a typed account-context passed explicitly so
"which book am I in" can never be ambiguous.

### 3. Self-grading determinism — **"grades itself" is only credible if history can't be quietly rewritten**

**Context.** The ledgers write predictions before the evidence and grade them in
public. That claim dies the first time the pipeline fudges a result.

**Design decisions.**
- Predictions + standing orders are written as **machine-readable meta** with
  immutable deadlines; a watcher fires on due-but-ungraded orders.
- **Two gates:** a per-ledger lint (binds the human-readable doc to the meta so a
  "Watch" PDF can't ship with a "Buy" status) and a board **doctor** (7 checks:
  price DB, doc↔meta parity, PDF, README, standing orders, outbox). Ship is a
  deterministic script; the model's job ends at writing the content.

> ⚠️ **What broke.** A price-attractiveness score described its basis as "since
> we opened this ledger" — but on a same-day open that window is empty (the code
> literally errors on it). The real basis was a trailing 6-month window. An
> adversarial review pass caught it; the doc now states the *real* measured
> window and numbers, never a convenient phrasing.

**Tradeoff / what I'd redesign.** Two gates + a deterministic ship pipeline is
heavier than "let the model commit." But it's the only way "self-grading" isn't
just a nice story. Next: property-based tests on the meta schema.

---

## Engineering practices (not P&L)
- **Every incident becomes a regression test** — the dedup, credential-remap, and stop-reissue bugs above are each pinned by one now.
- **Delivery proof, not exit codes** — the release path verifies its output actually landed (commit on origin, record in the outbox), so a half-finished run can't look clean.
- **Reboot-safe topology** — the 16 services restore to a saved known-good state.
- **Adversarial review before shipping** — I run external models against my own work to try to refute it first.

## Stack
Node.js (agent, tools, bridges) · Python (market data, research, backtests) ·
LLM tool-use + structured output · SQLite · pm2 · Cloudflare Pages · WhatsApp
(Baileys) · Alpaca. Solo: design, build, ops.

## What's real vs. prototype
**Real & running:** the runtime, the 29 tools, 16 services, 43 ledgers, the gates,
multi-account isolation, and gated live execution on small personal capital.
**Prototype only:** the consumer product vision built on the same runtime.
**Not claimed:** users, revenue, or investment performance.

## What this means for ARIN (the consumer product)

The same runtime is aimed at a consumer product — **[arinflow.com](https://arinflow.com)**, a private personal assistant. The safeguards above translate directly into product properties:

- **Injection defense → an assistant that reads your world without being hijacked by it.** Email, web pages, and messages are treated as data, never as instructions.
- **Gates, caps, and approvals → safe action.** The assistant can act (send, book, remind) only inside explicit, capped, approval-gated permissions — the same pattern that keeps an LLM from moving money it shouldn't.
- **Deterministic self-grading → honest memory.** Promises and records can't be quietly rewritten; the system keeps an auditable trail of what it said and when.

The point of the market testbed: ARIN is not a thin wrapper on a general LLM. The safety model was stress-tested against an adversarial, high-stakes domain *before* being pointed at family life.

## Contact
Senior AI Engineer (multi-agent LLM systems · 12+ yrs data & systems engineering) · [github.com/srinu16it](https://github.com/srinu16it) · reach me on [LinkedIn](https://www.linkedin.com/in/srinimerugu/)

**Inspectable slice you can run in 30 seconds:** [github.com/srinu16it/llm-tool-host](https://github.com/srinu16it/llm-tool-host) — the guard layer from problem #1. `npm test` runs the injection harness; `npm run demo` shows a compromised model get stopped.
