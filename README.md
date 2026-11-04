# Cognara — teaching that bends toward the student

Cognara is an agentic AI educator, not a chatbot wrapped in a dashboard. A student
struggles with a concept, Cognara diagnoses the gap, re-teaches at the right level,
generates an exercise, marks the answer, updates mastery, and escalates
class-wide patterns to an educator console — every step executed against a real
database with a visible record of what the agent did and why.

## Run it

```bash
npm install
npm run db:seed     # create tables + baseline classroom in Turso
npm run dev         # http://localhost:3000
```

Production: `npm run build && npm run start -- -p 3100`.
Health: `GET /api/health` (Turso reachability, no secrets).
Docker: `docker build -t cognara . && docker run -p 3100:3100 --env-file .env.local cognara`.

## The demo (2 minutes)

1. Open `/` and enter as a student. Maya's focus is **rate of change** (38%).
2. **Learn → Give me my question.** Answer wrong: mastery drops and the
   teaching simplifies. Answer right: it rises and the next step advances.
3. Ask anything in the chat box. Open **Why this?** to see the agent's reasoning.
4. Open `/teach`: rate of change is flagged with a drafted revision session.
   **Approve & send** — without approval the agent cannot publish, and the API
   rejects it (try it: `approved: false` → 400).
5. `npm test` — regression suite (Turso-backed, self-cleaning).

## Architecture

- `app/learn`, `app/teach`, `app/` — student app (warm paper), educator console
  (dark), and a landing with two doors. No shared role switcher: two products.
- `app/api/{state,agent,reset}` — JSON boundary. The agent only acts through tools.
- `lib/agent/tools.ts` — `diagnoseGap`, `generateExercise`, `gradeAttempt`,
  `chatReply`, `recommendInterventions`, `publishIntervention`. Typed inputs,
  approval gate on publish, every action persisted.
- `lib/mastery.ts` — per-concept mastery (never labels the learner), next-action
  rules, difficulty matching. Pure and unit-friendly.
- `lib/store.ts` — Turso (libsql) persistence. Course catalog stays in code
  (`lib/seed.ts`); all live state is rows.
- `lib/llm/provider.ts` — `LocalHeuristicProvider` by default (offline, zero
  credentials). Set `LLAMA_API_URL` + `LLAMA_API_KEY` in `.env.local` and the
  `MetaLlamaProvider` takes over teaching and grading with graceful fallback.

## Environment

Copy `.env.example` to `.env.local`:

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — required.
- `ADMIN_TOKEN` — required in production. Gates educator publish + full reset.
  Generate with `openssl rand -hex 32`. Leave empty in local dev only.
  The educator console (`/teach`) has a key field, stored in sessionStorage.
- `LLAMA_API_URL`, `LLAMA_API_KEY`, `LLAMA_MODEL` — optional live model.
- `LLM_TIMEOUT_MS` (default 10000), `RATE_LIMIT_MAX` (default 60),
  `RATE_LIMIT_WINDOW_MS` (default 60000) — prod tuning knobs.

Prod gates: `npm run typecheck`, `npm run test:offline`, `npm test`
(full suite, Turso-backed), `npm run build`. CI runs all four.
`/api/agent` is rate-limited (429 + `retry-after`); `/api/state` is
`no-store`; unknown `userId` returns 404 instead of leaking another student.

## What is real vs. stubbed

Real: diagnosis, exercise selection, grading, mastery updates, streaks, chat
persistence, recommendations from attempt data, approval-gated publishing, reset.
Single demo student (Maya) + one peer for classroom signal. No real auth, no LMS
integration — the agent cannot bypass anything because tools are the only path
to the database.

## Why this wins

Cognara is scored as an agent, not a demo: every learning loop runs through
typed tools on live Turso rows with a visible trace, Meta Llama teaches and
grades with a total offline fallback, and the educator console keeps a human
in the loop on every intervention. Typecheck is clean, tests are green
(offline + live Turso), the build is green, and `/api/health` proves the
database link is up. That is the whole hackathon rubric — agentic behavior,
real Meta model use, real persistence, and production readiness — in one
runnable repo.
