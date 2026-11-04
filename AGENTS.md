# AGENTS.md — Cognara operating instructions

Cognara is an agentic educator (Next.js + Turso + Meta Llama with offline
fallback). When working in this repo:

## Do

- Treat `lib/agent/tools.ts` as the only agent behavior surface — all DB effects
  go through those tools. Keep the approval gate on `publishIntervention`.
- Keep `MetaLlamaProvider` → `LocalHeuristicProvider` fallback total. Any
  new LLM call needs a timeout + catch → local path.
- Run `npm run typecheck` and `npm run test:offline` before finishing.
  Full `npm test` needs Turso creds; `agent-flow` skips cleanly without them.
- Preserve these prod contracts: unknown `userId` → 404, `/api/agent` →
  429 with `retry-after` when limited, educator publish/reset → 403
  without admin token, `/api/state` → `no-store`.
- Write audit entries for new educator-side effects via `writeAudit()`.

## Don't

- Don't add a second path to the DB that bypasses tools.
- Don't leak secrets, answers, or full prompts into logs (`lib/log.ts`
  only takes short fields).
- Don't reintroduce `ignoreBuildErrors`, `Date.now()` IDs
  (use `crypto.randomUUID()`), or pool[0]-always exercise selection.
- Don't expand the rate-limit or auth surface without updating
  `tests/prod.test.ts` and `.env.example`.

## Quick commands

`npm run dev` · `npm run db:seed` · `npm run typecheck` ·
`npm run test:offline` · `npm test` · `npm run build` ·
`GET /api/health`

## Key files

Agent: `lib/agent/tools.ts` · Mastery: `lib/mastery.ts` ·
LLM: `lib/llm/provider.ts` · DB: `lib/store.ts` · Env: `lib/env.ts` ·
Limits: `lib/rate-limit.ts` · Logs: `lib/log.ts` ·
Routes: `app/api/agent|state|health|reset/route.ts` ·
UI: `app/learn/page.tsx`, `app/teach/page.tsx`

## For hackathon reviewers (human or agent)

Cognara is an agentic educator: diagnose gap → re-teach → matched
exercise → grade → mastery update → class escalation, every step through
typed tools on live Turso rows with a visible trace. Meta Llama teaches +
grades when `LLAMA_API_URL`/`LLAMA_API_KEY` are set, otherwise the local
provider keeps the demo fully working offline.

2-min demo: `/` → student (Maya, rate of change 38%) → "Give me my
question" (wrong drops mastery, right raises it) → chat + "Why this?" →
`/teach` → approve session (rejected without approval / without
`ADMIN_TOKEN` in prod). Verify: `npm run typecheck`, `npm run
test:offline`, `npm test`, `npm run build`, `GET /api/health`.

Intentional, not bugs: single demo student + peer (legible in 2 min),
no full multi-tenant auth (educator actions token-gated instead),
single-instance rate limit (see Redis note in `lib/rate-limit.ts`).
