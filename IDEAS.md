# NoBadCookies Improvement Ideas

This document captures practical next-step improvements identified from a review of the current implementation.

## 1) Cookie deletion correctness
- **Delete by exact cookie identity** in background auto-cleanup by including `storeId` where available and ensuring URL construction is normalized for leading-dot domains.
- Consider a **fallback remove path** for cookies that fail `chrome.cookies.remove` on first attempt (alternate scheme/path normalization).
- Add telemetry counters for remove failures vs successes to make debugging easier.

### Progress
- ✅ Popup/manual delete path now uses cookie object details and propagates runtime errors to UI status feedback.
- ✅ Background auto-cleanup now tracks failed deletion attempts (`removedCookieFailedCount`) and includes `failedCount` in removal stats.
- ✅ Added fallback remove attempts in background auto-cleanup (normalized domain + HTTPS retry) before marking a deletion as failed.
- ✅ Added retry-success telemetry (`removedCookieRetrySuccessCount`) for background auto-cleanup retries.
- ⏭️ Next: expose retry success rate in a dedicated diagnostics UI panel.

## 2) Better domain coverage for auto-cleanup
- Current auto-cleanup targets `hostname` and `.hostname` only; add optional mode to remove cookies for related subdomains encountered during the tab session.
- Add a user setting for cleanup strictness:
  - **Conservative**: current behavior
  - **Balanced**: include first-party subdomains
  - **Aggressive**: include third-party cookies set while tab was active

## 3) Approved suppliers model cleanup
- Consolidate default supplier lists into a **single shared source** used by background and popup to avoid drift.
- Add structured validation/parsing for supplier patterns with clear error messaging:
  - `*`
  - `*.domain.tld`
  - `prefix.*`
  - exact `domain.tld`
- Surface the effective normalized pattern in UI after add.

## 4) Popup UX polish
- Show explicit toast/inline status for cookie save/delete success and errors (`chrome.runtime.lastError`).
- Add editable **Domain** and **SameSite** fields in edit/create mode for advanced workflows.
- Add a one-click **duplicate cookie** action in addition to edit/delete.
- Confirm destructive actions (bulk delete/import overwrite).

## 5) Data migration/versioning
- Introduce a lightweight settings schema version in storage and run migrations explicitly per version.
- Add migration tests for:
  - empty store
  - partially configured store
  - legacy store without new default suppliers

### Progress
- ✅ Added `settingsVersion` persistence scaffold in background install flow.
- ⏭️ Next: split migration steps into explicit versioned functions and add dedicated migration tests.

## 6) Observability and diagnostics
- Add a dedicated diagnostics tab in popup:
  - recent auto-delete attempts (success/fail)
  - matched supplier pattern for skipped deletions
  - last rule handler run
- Include exportable debug bundle (sanitized JSON).

## 7) Testing quality improvements
- Add focused unit tests for:
  - `removeCookie(cookie)` URL/detail construction (dot domains, path, secure, storeId)
  - edit-mode rename behavior (old cookie removed)
  - supplier merge migration in `onInstalled`
- Add a small integration-style test for popup edit flow:
  - click Edit → form prefill → Save → list refresh

## 8) Security and safety hardening
- Avoid `eval` for loading rules where feasible; prefer static imports or safe parsing pipeline.
- Tighten import validation for cookie JSON (required fields, type checks, max limits).
- Add optional guardrails for sensitive domains (banking/government) to avoid accidental cookie operations.

## 9) Performance and maintainability
- Debounce or coalesce repetitive script injections on rapid navigation events.
- Extract repeated helpers (URL normalization, pattern matching, storage keys) into shared utility modules.
- Document architectural boundaries and ownership of popup/background responsibilities.

## 10) Product direction ideas
- Per-site profiles: banner handling + cleanup policy + supplier exceptions.
- Scheduled cleanup windows (e.g., nightly) for non-approved domains.
- Optional cloud sync (where browser supports) for supplier and whitelist settings.
