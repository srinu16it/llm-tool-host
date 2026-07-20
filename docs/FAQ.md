# FAQ

*The questions a skeptical engineer asks, answered without spin.*

**Is this production-ready?**
It's a **reference implementation** of a pattern that runs in production inside a larger private system (16 services, 29 tools — see the [case study](../CASE_STUDY.md)). This repo is the extracted, tested core: small on purpose so you can audit it, then adapt it. Copy the four files; don't `npm install` your safety layer.

**Why zero dependencies?**
Because the pitch is *"you can read the entire safety argument in one sitting."* Every transitive package is something your reviewer didn't read. The whole runtime is ~150 lines of standard Node.

**How do I use a real model instead of the scripted one?**
Implement one method: `next(transcript) → {kind:'tool', call} | {kind:'final', text}`. Behind that interface, call Anthropic or OpenAI tool-use and map their tool-call response into `call = {tool, args}`. The host, guard, registry, and envelope don't change — swapping the model is the one seam, by design.

**What does this NOT protect against?**
- **Malicious tool implementations.** The guard decides *whether* a tool may run; if your `run()` itself exfiltrates data, that's on the tool author. Keep tools small and reviewed.
- **A hostile human caller with granted scopes.** Policy describes what a caller *may* do; pick `grantedScopes`, `trustedSender`, and `caps` accordingly.
- **Prompt injection changing the model's *text answer*.** The guard protects *actions*. A compromised model can still write misleading prose — that's a content-quality problem, not an execution one.

**Isn't the untrusted-content envelope just prompt engineering?**
Yes — and it's treated that way. The envelope is defense-in-depth for well-behaved models; the **guard** is the actual defense. The injection test scripts a model that ignores the envelope completely, and the money still doesn't move.

**Why is the guard synchronous? My policy check needs a database.**
Keep the pure guard as the *last* gate and do async lookups (account state, quotas) *before* building the `policy` object you hand to the host. The separation is the feature: the final decision stays a pure function you can test exhaustively.

**Can a blocked model retry forever?**
No — the loop is bounded (`maxSteps`, default 8). Blocked calls are fed back as system notes so a legitimate model can recover; a hijacked one runs out of turns.

**Who built this and why?**
Extracted by [Srinivas Merugu](https://github.com/srinu16it) from a solo-built multi-agent runtime whose agents touch real accounts — the environment where this pattern was stress-tested first. The full architecture, the three hard problems, and what broke along the way: [CASE_STUDY.md](../CASE_STUDY.md). The consumer vision on the same runtime: [arinflow.com](https://arinflow.com).

---

*Next: [Getting started](GETTING_STARTED.md) · [Concepts](CONCEPTS.md) · [Case study](../CASE_STUDY.md)*
