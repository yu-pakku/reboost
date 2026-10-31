# ReBoost — Product Requirements & Technical Specification

- Version: 1.0 (implementation baseline; provisional choices explicitly marked)
- Date: 2026-10-30
- Status: Proposed MVP specification, not a claim of completed implementation
- Language: Japanese UI; Japanese locale; Asia/Tokyo timezone
- Primary goal: personal-use memory-retention assistant built around short, scheduled retrieval opportunities.

## 1. Background and priorities

ReBoost is a personal-first PWA that helps the user encode and retain knowledge they have learned but don't frequently use. Register a term and its explanation, complete six progressively structured reviews (2× confirmation, 2× reverse recall, 2× cloze), then pass a delayed final test. Successfully tested knowledge fills an animated, brain-shaped reservoir on the home screen. The application is a tool, not a scientific certification of memory retention.

Priorities: (1) functional correctness and reliable data, (2) low friction, (3) excellent mobile/iPhone UX, (4) offline-tolerant use, (5) attractive, white-based, playful but restrained design. No AI API in MVP. No commercialization, marketplace, social features, course builder, gamified paywalls, or generic knowledge encyclopedia.

## 2. Scope and decisions

### Must-have MVP (Phase A)
1. Japanese mobile-first responsive interface with Home / Review / Account bottom navigation.
2. Add/edit/archive/delete knowledge with term, definition and guided cloze selection.
3. One knowledge entry works independently; never require other entries or dummy data.
4. State machine for L1×2 → L2×2 → L3×2 → delayed Final; track attempts.
5. Accurate local persistence after reload/relaunch; backup as JSON export/import.
6. Review queue sorted by due time; clear overdue and missed reminders semantics.
7. Final test, completion history, earned mastery indicator, and brain-like progress visualization (initially CSS/SVG acceptable; advanced animation later).
8. Installable PWA with appropriate manifest/icons/service worker and functioning offline shell after a first online load; offline limitations explicitly surfaced.
9. Automated tests for core scheduling, grading, state transitions and import/export.

### Phase B — background notifications/sync
- Actual Web Push notifications on supported iOS Home Screen PWAs and other compatible browsers, requiring explicit permission and subscription.
- Server-side persistence of due jobs and subscriptions (e.g. Supabase), a protected scheduled dispatcher, retry/duplicate-suppression, and time zone handling.
- Optional multi-device sign-in and sync only if needed; do not impose auth in local-first MVP.
- Vercel Hobby cron allows only once-daily jobs with coarse hour-level scheduling. Do NOT promise exact-minute notifications or multiple per-day notifications using Vercel Hobby cron alone. An alternative scheduler/provider or paid tier must be evaluated if precise/multiple notifications become requirements.
- Local in-app due indicators are not the same as background push notifications. Do not claim that PWA installation enables timed push without a sender.

### Explicit non-goals in MVP
- LLM-powered question creation or grading, semantic grading of free-text definitions.
- Multiple choice with arbitrary or misleading distractors.
- Proof that learned knowledge will remain remembered permanently.
- Complex spaced-repetition adaptivity, social leaderboard, production-grade cloud account management.

## 3. UI and navigation

Design: white base, dark text, restrained light-blue/teal highlights, subtle gradients, rounded corners, ample whitespace, generous tap targets (>=44×44 CSS px), readable fonts, keyboard-safe forms, reduced-motion support, dark mode optional later. It should feel playful yet credible enough to showcase in an academic or job portfolio. Avoid copying existing brands/screens.

### Home (center tab)
- Header: ReBoost, notification state/settings access.
- Primary centerpiece: large transparent brain/head-shaped container containing particles for successfully completed knowledge; current total displayed numerically. Avoid claiming this is a direct brain-health measurement.
- Prominent “＋知識を追加” CTA.
- Today's due count, overdue count, quick start review action, optionally recent knowledge / knowledge library access.
- Empty state tells user to register their first item; app must work with exactly one item.

### Review (left tab)
- Queue: due now, overdue, upcoming; progress stage, due date/time, counts.
- One short focused task at a time; no unnecessary menu navigation. Submit, feedback, next.
- For L1 show term AND definition; user taps “確認した” (no objective score). Consider optional self-check later, but not part of progression logic.
- For L2 show stored definition and request the term (must avoid leaking the term within the prompt).
- For L3 show stored definition with user-selected contiguous text span replaced with a blank; type the missing span. Do not manufacture grammatically altered sentences by heuristic.
- For Final ask L2 and L3 prompts without showing the correct answer between questions; show a combined result after both.

### Account (right tab)
- Basic profile (local-only name optional); counts: registered, preliminary mastered, pending, reviews.
- Daily activity log, past attempts, settings for daily reminder preference and data export/import.
- Privacy/data-storage explanation and offline indicator.

### Knowledge creation (modal or dedicated route; choose dedicated route if mobile keyboard needs room)
Required fields for graduation: `term` (1–100 characters), `definition` (1–1000 characters), one `cloze` span appearing verbatim in `definition` (1–100 characters). MVP recommended: make cloze selection a required final step in the registration wizard so that every item can reach L3. This is a *provisional design choice* because earlier discussions considered optional cloze. Use selection from definition text rather than a disconnected text entry; allow a manual selection repair step. Preview L2 and L3 before Save.

Validation: normalize whitespace for empty checks, safely store Unicode; preserve original rendered text. If description contains the registered term, display a warning and require editing/rephrasing the description for L2 before saving; otherwise the answer is given away. For identical span occurrences, store start/end offsets for the chosen one instead of global replace. Ensure valid UTF-16/Unicode handling in JS and predictable selection behavior. Alias answers optional in later version. Duplicate terms permitted with warning (some terms may have multiple definitions).

### Knowledge library
- Search by term/definition, filter by learning/mastered/archived, edit and delete.
- Edits to test-relevant content while in progress require explicit confirmation because test history and existing answers become stale. Recommended behavior: reset learning progress on term/definition/cloze edits, preserve old attempts as historical records; archive does not remove history; hard delete only with confirmation.

## 4. State machine and scoring

Canonical statuses: `learning`, `final_due`, `mastered`, `archived`. Learning has `level` in {1,2,3}, `successes_in_level` in {0,1}, `next_due_at`, `last_review_at`.

Progression:
- Initial item: `learning`, level=1, successes=0, next_due_at=created_at (available immediately). Users must choose to begin; no automatic review completion.
- L1: display term + definition, tap “確認した” -> advance one success. Confirmation is not a correctness measurement.
- L2: show definition -> enter term. A correct input advances. Incorrect input records failure, reveals correct answer, and **does not** advance.
- L3: blank user-selected span of original definition. Correct input advances. Incorrect records failure, reveals answer, does not advance.
- When 2 successes reached in a level, transition to next level, reset successes=0.
- After 2 successes at L3, transition to `final_due` with delayed final review.
- Final consists of two independently graded prompts L2 and L3; user cannot see correct answers until both submitted. BOTH must be correct to mark `mastered`.
- Final failure: keep or return to the failed question type (level 2 or 3), require **two more successful spaced retrievals of that type**, and then schedule a new delayed final. If both fail, begin at L2. This is a provisional, simpler remediation policy; never reset to L1 automatically.
- `mastered` = passed *app-specific preliminary mastery criterion*; user may manually request retest later. Do not imply scientific proof or permanent storage.
- Invalid/empty input does not count as an attempt.

### Deterministic grading
- Unicode normalization NFKC, trim, collapse regular whitespace, ASCII case-fold for Latin characters; compare exact text after normalization.
- Optionally whitelist accepted aliases in a later version; do not apply arbitrary fuzzy similarity for final pass.
- A correct alias should be explicitly stored, not inferred; avoid accepting contradictory statements through keyword-only comparison.
- Grade term (L2) and exact chosen span (L3), not arbitrary long free-text descriptions.
- Store answer, correctness, timestamp, knowledge ID, question type; protect against accidental repeat submissions via an attempt ID / idempotency key.

### Scheduling (provisional defaults; user did NOT explicitly choose exact intervals)
- All times store as UTC instants; display Asia/Tokyo.
- First L1 immediately at creation.
- After successful L1#1: +1 day.
- After L1#2: L2#1 due +1 day.
- After L2#1: +1 day.
- After L2#2: L3#1 due +2 days.
- After L3#1: +2 days.
- After L3#2: Final due +3 days.
- On a failed L2/L3: reattempt no sooner than next day (MVP fixed rule), do not make the user retype immediately to earn progress.
- On final failure: remediation repeats spaced by at least one day, then another delayed final after at least 3 days.
- If overdue, keep due item available; do not retroactively credit missed reviews; schedule the next interval from the **actual completion timestamp**, not historical due date.
- Keep scheduling parameters in named constants and cover with tests; do not present these numbers as scientifically optimized.
- Daily aggregate reminders are preferred over a push per knowledge item. Avoid notification floods.

## 5. Data entities

Use `id` as UUID; timestamps ISO 8601 UTC; migrations versioned. Proposed schema:

`Knowledge`: id, term, definition, cloze_start, cloze_end, created_at, updated_at, archived_at?, term_aliases? (future)

`LearningProgress`: knowledge_id, status, level?, successes_in_level, next_due_at?, last_review_at?, mastered_at?, final_attempt_count, updated_at

`ReviewAttempt`: id, knowledge_id, kind (`l1_confirm` | `l2_reverse` | `l3_cloze` | `final_reverse` | `final_cloze`), response?, is_correct? (`null` for L1), attempted_at, final_session_id?

`Settings`: locale, timezone, notification_preference, preferred_daily_reminder_hour, data_schema_version

Phase B: `PushSubscription` tied to one installation/device and authenticated user or one dedicated owner: endpoint, keys, expiration, last_delivery_status; `NotificationDelivery` or equivalent for deduplication, retries, logs.

Consistency: updates to progress and attempts are atomic within local DB transaction. Preserve previous progress on app reload, blocked network, or crash. Import validates schema/version, sizes, IDs, references and conflicts before mutating DB; offer replace vs merge only when safe. Export includes registration, progress, attempts, settings, schema version; sanitize private fields and never export push auth secrets by default.

## 6. Architecture

### Phase A stack
- Next.js App Router, React, TypeScript (strict), Tailwind CSS optional but recommended.
- IndexedDB via Dexie for offline durable client storage, with explicit error messaging for private browsing / quota restrictions. Browser storage may be cleared; provide backup/export prominently.
- React hooks and isolated repository/service layer; put grade/schedule/state machine pure functions in `src/domain` with deterministic tests.
- PWA manifest, service worker, icons, HTTPS deployment; test install on iOS device (simulator/desktop browser testing is insufficient for iPhone push behavior).
- Vercel Hobby deployment; no always-on server and no Next API required for local-only Phase A.

### Phase B stack
- Supabase Postgres for authoritative schedule + push subscription data, server-only secrets.
- Protected Next.js Route Handler for dispatch; auth on cron endpoint (e.g. CRON_SECRET); secrets not exposed in `NEXT_PUBLIC_*`.
- Web Push VAPID (public key on client, private key only on server) and service-worker `push` / `notificationclick` handling.
- Permissions requested only via user gesture in installed iOS Home Screen PWA; support denial and device incompatibility gracefully.
- Server-side dispatcher idempotent; use due-at filters, audit/delivery state and retries with capped attempts.
- Time precision: Vercel Hobby cron once per day, hourly window. For multi-times-per-day reminders, consider alternative scheduling or plan upgrade; avoid conflating cron job count with reminder count.
- Phase B changes sync/local semantics: establish one authoritative store and reconciliation/backup policy before enabling sync.

## 7. Screen routes (suggestion)

`/` Home; `/review` Review; `/knowledge/new` Add; `/knowledge` Library; `/knowledge/[id]` Detail/Edit; `/account` Statistics & Settings; `/test/[id]` Final (or dedicated modal). Mobile bottom nav persistent except during focused test and keyboard-heavy registration where it may hide.

## 8. Accessibility, security, reliability

- Semantic labels, focus states, keyboard navigation, >=44px targets, contrast, reduced motion, accessible error messages.
- No user content sent to AI or third-party analytics in MVP.
- Prevent XSS by rendering user text as text, not raw HTML.
- Prevent loss of locally stored knowledge via JSON export/import and versioned data migrations.
- For cloud version, enforce authorization and per-user row-level security; make single-owner app explicit, rate limit writes/notifications, validate requests server-side.
- PWA cache app shell/assets; avoid caching sensitive API responses indiscriminately.
- Clear notifications should open correct item/queue and not mark as completed automatically.
- No false notification delivery claims; permission and subscription state displayed.

## 9. Minimum acceptance tests

1. With zero entries, Home and Review show helpful empty states; add 1 item and all three stages work without any other item.
2. Create `HTTP` / `Web通信で利用されるプロトコル` / selected span `プロトコル`; generated L2 asks for `HTTP`, L3 blanks exactly `プロトコル`.
3. Warning if definition includes `HTTP`, and cannot accidentally expose answer in L2 prompt.
4. L1 requires explicit confirm; after second completed L1 moves to L2 without unearned progress.
5. Wrong L2/L3 never advances, reveals correct answer, and schedules appropriate retry.
6. Exact normalized answer grading handles ASCII case, fullwidth Latin and surrounding whitespace.
7. Final tests are both answered before showing correct answers; only 2/2 passing earns mastered.
8. After final failure, remediation behavior uses failed category and retains attempt history.
9. Reopen app/reload/offline mode: data and progression intact; next due is calculated from actual completion time.
10. Export/import roundtrip preserves all knowledge and progress, with duplicate/invalid import protection.
11. Editing definition/cloze asks permission for progress reset; archive/hard-delete behaviors explicit.
12. Mobile keyboard, long definitions, Japanese IME, accessibility and offline shell tested.
13. Phase B only: verify iOS Home Screen install -> permission by tap -> subscription -> actual push on locked device, no duplicate reminders, accurate disabled/denied state.

## 10. Milestones and review gates

M0: Scaffold, docs, tooling, CI/unit tests. Must run lint, typecheck, build.
M1: Design system + navigation and empty states; iPhone-sized responsive screenshot review.
M2: Knowledge registration/library/edit/delete; DB persistence, backup export/import; tests.
M3: Pure domain scheduling/state machine/grading + tests; review UI.
M4: Final tests, mastery state, brain visualization, account stats; end-to-end test covering single item.
M5: Installable PWA, offline reliability, Vercel deployment instructions; verify mobile install.
M6 (separate): Cloud data/notification backend, subscription flow and push tests; requires deliberate product decision and infrastructure credentials.

At each milestone, agent reports changed files, test/build results, visible behavior and unresolved issues. Fix validation failures before progressing. Commit only after review/approval; do not perform destructive actions, publish, or deploy without explicit approval.

## 11. Unresolved / to validate in use

- Are the above intervals better than simpler same-day repetition? Treat as adjustable experiment, not a scientific law.
- Should final have more than 2 tasks or a longer (e.g. 7/14-day) follow-up? Initial answer is 2 questions + optional later retest.
- Mandatory cloze selection increases input friction; usability-test and revisit if too costly.
- Some knowledge is not naturally expressible as term/definition. This MVP optimizes for terminology, not arbitrary conceptual mastery.
- User may want true multiple notifications per day; evaluate scheduler/cost before implementation.
- Brain animation visual direction and final icon to be reviewed visually after M4.

## 12. Definition of done (MVP)

Single-user installable Japanese PWA: a person can add a single entry, complete 2 confirmations / 2 reverse typed recalls / 2 cloze recalls over scheduled days, pass a delayed 2-question final, see it count toward mastery and the brain visualization, restart later without losing progress, and export/import knowledge. Phase B background push is explicitly *not* claimed complete until independently verified on an iPhone.
