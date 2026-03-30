⚠️ Mandatory: AI agents must read this file before writing or modifying any code.

# AGENTS.md

This file complements the workspace-level Ansiversa-workspace/AGENTS.md (source of truth). Read workspace first.

MANDATORY: After completing each task, update this repo’s AGENTS.md Task Log (newest-first) before marking the task done.

## Scope
- Mini-app repository for 'event-planner' within Ansiversa.
- Follow the parent-app contract from workspace AGENTS; do not invent architecture.

## Phase Status
- Freeze phase active: no new features unless explicitly approved.
- Allowed: verification, bug fixes, cleanup, behavior locking, and documentation/process hardening.

## Architecture & Workflow Reminders
- Prefer consistency over speed; match existing naming, spacing, and patterns.
- Keep Astro/Alpine patterns aligned with ecosystem standards (one global store pattern per app, actions via astro:actions, SSR-first behavior).
- Do not refactor or change established patterns without explicit approval.
- If unclear, stop and ask Karthikeyan/Astra before proceeding.

## Where To Look First
- Start with src/, src/actions/, src/stores/, and local docs/ if present.
- Review this repo's existing AGENTS.md Task Log history before making changes.

## Task Log (Recent)
- 2026-03-30 Initialized app-spec.md using standard V1 template from web repo.
- 2026-03-29 Completed readiness tooling alignment: installed local typecheck dependencies, standardized `db:push` support, preserved app-specific production DB isolation config, and prepared repo for freeze-safe commit/push without app logic changes.
- 2026-03-29 Synced local repo to `origin/main` after stale local seed commit divergence blocked pull; preserved prior local state on `backup/pre-pull-sync-2026-03-29`.
- Keep newest first; include date and short summary.
- 2026-03-25 Implemented Event Planner V1 (Astro DB schema, protected /app workspace + /app/events/[id], actions ownership checks, archive/restore, Alpine global store, dashboard+notification webhooks). Verified `npm run build`; `npm run typecheck` blocked by missing @astrojs/check in restricted registry.
- 2026-02-09 Added repo-level AGENTS.md enforcement contract (workspace reference + mandatory task-log update rule).
- 2026-02-09 Initialized repo AGENTS baseline for single-repo Codex/AI safety.
