# Why This Wins — Cognara

Cognara is an agentic educator, not a chatbot demo. This doc maps the build
to what hackathon judges actually score, with every claim checkable in the
repo.

## 1. Real agent behavior

Every learning loop runs through typed tools in `lib/agent/tools.ts` —
`diagnoseGap`, `generateExercise`, `gradeAttempt`, `chatReply`,
`recommendInterventions`, `publishIntervention`. Tools are the only path
to the database. Each tool returns a `TraceStep[]` rendered in the UI
under "Why this?", so judges see the agent's reasoning, not just output.

Check: read `lib/agent/tools.ts`, then run the student loop on `/learn`
and open "Why this?" after any action.

## 2. Real Meta model use

`MetaLlamaProvider` (`lib/llm/provider.ts`) teaches and grades through the
configured Llama endpoint with a 10s timeout. Any failure — missing creds,
timeout, bad response — falls back to the deterministic local provider,
so the demo never dies on stage. Set `LLAMA_API_URL` + `LLAMA_API_KEY`
to see Meta's model live; unset them to see the offline path.

Check: `lib/llm/provider.ts` lines 109–175, `tests/provider.test.ts`.

## 3. Real persistence

Turso/libsql (`lib/store.ts`): students, per-concept mastery, attempts,
chats, interventions, audit logs. The course catalog lives in code
(`lib/seed.ts`); all live state is rows. Schema DDL runs once per
instance; `GET /api/health` proves the DB link with `SELECT 1`.

Check: `npm run db:seed`, then `curl localhost:3000/api/health`.

## 4. Human in the loop

Nothing reaches a student without educator approval. Publishing requires
`approved: true` AND (in production) an `ADMIN_TOKEN` (`/teach` console
key field, sessionStorage only, sent as `x-admin-token`). Reset needs
`{ "confirm": true }` plus the token. Unknown `userId` returns 404 —
never another student's data.

Check: `app/api/agent/route.ts`, `app/api/reset/route.ts`,
`tests/prod.test.ts`.

## 5. Production readiness

Rate limiting (60/min/IP, 429 + `retry-after`), request IDs on every
API response, structured JSON logs in prod, audit trail on educator
actions, security headers, `output: standalone` Docker image, CI running
typecheck + offline tests + build. Unknown-user 404, `no-store` state.

Check: `Dockerfile`, `.github/workflows/ci.yml`, `middleware.ts`,
`lib/rate-limit.ts`, `lib/log.ts`.

## 6. Verified, not claimed

- `npm run typecheck` — clean, zero `ignoreBuildErrors`.
- `npm run test:offline` — 11/11 green.
- `npm test` — 13/13 green including the live Turso flow.
- `npm run build` — green.

## 2-minute demo

1. `/` → enter as a student. Maya's focus: rate of change, 38%.
2. Learn → "Give me my question." Answer wrong: mastery drops, teaching
   simplifies. Answer right: it rises.
3. Ask anything in chat. Open "Why this?" for the trace.
4. `/teach` → rate of change flagged. "Approve & send" publishes.
   Without approval or token → rejected with a clear error.

## Honest scope

Single demo student (Maya) + one peer is intentional — legible in two
minutes. No full multi-tenant auth by design; educator actions are
token-gated instead. Single-instance rate limiting (Redis swap noted in
`lib/rate-limit.ts`).

## Architecture

```text
/learn (student)            /teach (educator console)
      \                            /
       v                          v
  POST /api/agent            POST /api/agent (publish, gated)
  GET  /api/state            GET  /api/state
       |                            |
       +------> lib/agent/tools.ts <-+
                  | diagnose · generate · grade
                  | chat · recommend · publish
                  +--> lib/mastery.ts (pure math)
                  +--> lib/llm/provider.ts (Llama → local)
                  +--> lib/store.ts (Turso/libsql)
```

- `app/learn`, `app/teach`, `app/` — two products, no shared role
  switcher: warm paper student app vs. dark educator console.
- `app/api/{agent,state,health,reset}` — the JSON boundary. The agent
  only acts through tools; there is no second DB path.
- `lib/mastery.ts` — per-concept mastery, never labels the learner.
  `recordAttempt` clamps 0–100, handles non-finite input, applies
  diminishing returns above 85.
- `lib/store.ts` — Turso persistence. `ensureSchema` runs once per
  instance; `loadDb` snapshots students, mastery, attempts (newest
  first), chats, interventions. `writeAudit` never breaks primary writes.
- `middleware.ts` — stamps `x-request-id` on every `/api/*` call and
  enforces baseline security headers at the edge.

## Request flows

Student grade loop:

```text
answer → POST /api/agent {op:grade} → rate-limit check
  → gradeAttempt → provider.grade → recordAttempt → applyAttempt
  (mastery + attempt row + streak/minutes, one batch)
  → recentWrongStreak (newest-first) → nextAction → provider.teach
  → trace[] → 200 + x-request-id
```

Educator publish loop:

```text
approve → POST /api/agent {op:publish, approved:true}
  + x-admin-token → isAdminRequest? 403 if not
  → recommendInterventions → match concept → addIntervention
  → writeAudit(educator, publish) → 200 + x-request-id
```

Focus selection (`GET /api/state`): stay on the student's current
thread (newest attempt concept) until mastery hits 70, then move to
the weakest concept. Unknown explicit `userId` → 404, never a
fallback to another student's rows.

## Tool contracts

| Tool | Input | Output | Rejects with |
|---|---|---|---|
| `diagnoseGap` | student, concept | mastery, streak, action, trace | unknown student/concept |
| `generateExercise` | student, concept | exercise @ difficulty, rotation-aware | no exercises for concept |
| `gradeAttempt` | student, exercise, answer ≤2000 chars | correct, feedback, before→after, followUp | empty answer, unknown ids |
| `chatReply` | student, text ≤2000 chars, concept | adaptive reply, trace | empty message, unknown ids |
| `recommendInterventions` | — | concepts with avg + affected, sorted worst-first | — |
| `publishIntervention` | concept, approved=true | intervention row, trace | not approved, no open rec |

Rotation: candidates at the matched difficulty are ordered by
least-recently-attempted, so students don't get the same question
twice when a pool has depth. IDs are `crypto.randomUUID()` —
no `Date.now()` collisions under double-submit.

## Mastery math (exact)

- Correct: foundations +10, guided +8, challenge +6; halved at ≥85.
- Wrong: foundations −4, guided −6, challenge −5. Floor 0, ceiling 100.
- `nextAction`: reteach if mastery <40 or wrong-streak ≥2; practice
  if <70; apply if <85; else advance/challenge.
- `difficultyFor`: reteach→foundations, practice→guided,
  apply→guided, advance→challenge.

## API contracts

| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| `POST /api/agent` | token only for publish | 200 + `x-request-id` | 400 validation, 403 no token, 429 limited, 503 DB/LLM down |
| `GET /api/state?userId=` | none (read) | 200, `no-store` | 404 unknown student, 503 DB down |
| `GET /api/health` | none | 200 `{ok, db:up, latencyMs}` | 503 `{ok:false, db:down}` |
| `POST /api/reset` | token + `{confirm:true}` | 200 `{ok, students}` | 400 no confirm, 403 no token, 503 failed |

Rate limit: 60 req/min/IP default (`RATE_LIMIT_MAX` /
`RATE_LIMIT_WINDOW_MS`), 429 carries `retry-after`.
LLM timeout: 10s abort (`LLM_TIMEOUT_MS`), always falls back local.

## Failure modes (all covered)

| Failure | Behavior | Proof |
|---|---|---|
| Llama down / slow / bad key | local provider answers, grading continues | `provider.test.ts`, try/catch + abort |
| Turso unreachable | 503 JSON, health reports `db:down` | `/api/health`, agent 503 branch |
| Empty answer / message | 400, agent refuses to grade nothing | tools + route validation |
| Double-submit | `busy` flag in UI, UUID ids in DB | `learn/page.tsx`, tools |
| Unknown student | 404, no data leak | state route, `prod.test.ts` |
| Publish w/o approval/token | 400 / 403, nothing written | agent route, teach console |
| Reset w/o confirm+token | 400 / 403, DB untouched | reset route |
| Burst traffic | 429 + `retry-after`, logs event | `rate-limit.ts` |
| Oversized input | trimmed to 2000 chars everywhere | route + tools caps |
| Non-finite mastery | defaults to 50, never NaN | `mastery.test.ts` |

## Test matrix

| Suite | Needs Turso | What it proves |
|---|---|---|
| `tests/mastery.test.ts` | no | clamps, bounds, NaN-safe, action thresholds, difficulty map |
| `tests/provider.test.ts` | no | exact + factored + unit-tolerant grading, true/false leniency, 5000-char safety |
| `tests/prod.test.ts` | no | rate-limit bucket trips, admin gate closed in prod / open in dev |
| `tests/agent-flow.test.ts` | yes (skips cleanly w/o) | foundations exercise for struggler, grade persists + restores baseline |

Run: `npm run test:offline` (fast, no creds) then `npm test`
(full, live Turso, self-cleaning). CI runs typecheck + offline +
build on every push.

## Deployment runbook

Local:

```bash
npm install
cp .env.example .env.local   # fill Turso + ADMIN_TOKEN
npm run db:seed
npm run dev                  # http://localhost:3000
```

Production (node):

```bash
npm run build
npm run start -- -p 3100
curl localhost:3100/api/health   # expect {ok:true, db:"up"}
```

Production (docker):

```bash
docker build -t cognara .
docker run -p 3100:3100 --env-file .env.local cognara
```

| Var | Required | Default | Notes |
|---|---|---|---|
| `TURSO_DATABASE_URL` | yes | — | libsql URL, no `<` placeholders |
| `TURSO_AUTH_TOKEN` | yes | — | Turso token |
| `ADMIN_TOKEN` | prod only | empty (dev open) | `openssl rand -hex 32` |
| `LLAMA_API_URL` | no | — | unset = offline local mode |
| `LLAMA_API_KEY` | no | — | unset = offline local mode |
| `LLAMA_MODEL` | no | Llama-4-Maverick-17B-128E-Instruct | override per deployment |
| `LLM_TIMEOUT_MS` | no | 10000 | abort-then-fallback |
| `RATE_LIMIT_MAX` | no | 60 | per IP per window |
| `RATE_LIMIT_WINDOW_MS` | no | 60000 | window length |

## Judge verification checklist

```bash
npm run typecheck    # expect: clean, no output
npm run test:offline # expect: all pass, no creds needed
npm test             # expect: all pass incl. live Turso flow
npm run build        # expect: green, 8 routes
curl localhost:3000/api/health  # expect: {"ok":true,"db":"up"}
```

Then in the browser: wrong answer drops mastery and simplifies
teaching; right answer raises it; "Why this?" shows the trace;
`/teach` flags rate of change; approving publishes; rejecting
(`approved:false`, missing token) fails with a clear error.

## Threat model (demo-scoped)

- Student identity is a `userId` param defaulting to Maya — spoofable
  by design for the demo. Compensations: unknown IDs 404, educator
  writes token-gated, no PII beyond first names, no LMS integration.
- Admin token travels as `x-admin-token` header, stored in
  sessionStorage (tab-only, never localStorage, never logged).
- Logs carry only short fields (`lib/log.ts`) — never secrets,
  answers, or full prompts. Audit rows cap detail at 2000 chars.
- Multi-instance rate limiting needs Redis (noted in
  `lib/rate-limit.ts`); current bucket is per-instance.

## Roadmap (out of scope, deliberately)

Full user accounts, LMS import, richer exercise pool, per-student
pacing models, Redis-backed limits, educator audit UI. None of these
are needed for the win; the loop above is the win.
