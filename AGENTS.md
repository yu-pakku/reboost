# ReBoost: instructions for coding agents

- Read `SPEC.md` before designing or changing behavior. It is the implementation baseline. The user has final authority over changing product decisions.
- UI copy and application locale: Japanese. Product: personal memory-retention PWA for iPhone with white-first tasteful playful visual design.
- Use strict TypeScript, clear module boundaries, small functions. Store the domain state machine, grading and due-date calculations as pure tested functions, independent of UI and persistence.
- Implement M0–M5 from `SPEC.md` in order. Treat M6 push/backend as a separate scope that requires explicit approval and credentials.
- First propose a concise milestone implementation plan and record assumptions. Do not substitute different quiz formats, fabricate plausible MCQ distractors, add LLM APIs, or claim that a test proves permanent memory.
- Prevent answer leakage in reverse questions; cloze uses exact registered text offsets; support one isolated knowledge entry.
- Write tests for state transitions, failure behavior, normalized matching, local transactions, import/export and overdue schedule.
- After each milestone run available lint, typecheck, unit tests and production build; fix errors before moving on. Report tested commands/results and manual testing gaps.
- Do not modify/delete unknown user files; do not push, deploy, connect paid services or commit secrets without approval.
- For PWA, be precise: installability ≠ push availability. iPhone background push requires a separate verified backend flow in M6.
