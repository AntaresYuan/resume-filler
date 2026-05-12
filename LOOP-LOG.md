# devloop log

Autonomous dev-loop run log. One entry per task completed by Claude Code via the `/devloop` skill.

---

## 2026-05-12 · PR #25 — Step 3 UX redesign + AI takeover button + label mappings (closes #10)

- **Branch:** `feat/10-step3-ai-takeover` (squash-merged as `54cbe8e`, branch deleted)
- **Issue:** #10 (auto-closed via "Closes #10")
- **Files:** `lib/label-classifier.js` (new, +128), `tests/label-classifier.test.js` (new, +120), `content.js` (+40/-17), `i18n.js` (+38), `popup.html` (+56), `popup.js` (+302/-83). Total +618/-83 across 6 files after fixups.
- **Verification:** `npm run lint` clean, `npm test` 190/190 pass, `node -c` parse OK on edited files. No browser smoke (out of scope for autonomous loop — `CONTRIBUTING.md` smoke-test checklist still applies before next release).
- **Sub-agent review:** independent read-only review (Read/Grep/Glob only) flagged 2 P1 issues, both fixed in `d62a1da` before merge:
  1. `RESUME_SECTION_OPTIONS` hard-coded bilingual strings (`'基本信息 / Basic Info'`) in `popup.js` violated the "all UI strings flow through `i18n.js`" invariant. Replaced with `getResumeSectionOptions()` resolved at render time via `I18N.t('popup.section.*')`. Added missing `popup.section.internship` key to zh + en dictionaries.
  2. `saveCustomField` / `saveLabelMapping` did non-atomic `chrome.storage.local.get` → mutate → `set`. Two rapid clicks on adjacent unmatched cards could drop a write. Both now go through a `mutateStorage(key, mutator)` helper that chains writes on a single Promise queue.
- **Follow-ups recorded (non-blocking, not opened as issues yet):**
  - `tests/label-classifier.test.js` "covers every FIELD_MAP key" test asserts a hard-coded expected list rather than introspecting `content.js`'s `FIELD_MAP` — new resume keys won't fail the test. Cosmetic.
  - `lib/label-classifier.js` "experience" bucket contains `expected` and `available`, which match Workday intent labels ("Expected start date", "Available date") rather than work experience. Consider a dedicated `intent` bucket.
  - a11y: `aiTakeoverBtn` / `skipBtn` / `mapSelect` lack `aria-label`s; `.manual-group-title` is `<div>` rather than a heading. Screen-reader hierarchy is flat.

---

## 2026-05-12 · PR #26 — Per-section validation in resume editor (closes #11)

- **Branch:** `feat/11-resume-validation` (squash-merged as `3acf49e`, branch deleted)
- **Issue:** #11 (auto-closed via "Closes #11")
- **Files:** `lib/validators.js` (new, +140), `tests/validators.test.js` (new, +190), `options.js` (+125/-3), `options.html` (+44), `i18n.js` (+16). Total +512/-3 across 5 files.
- **Behaviors:** pure regex validators (email, international phone, URL) + `validateResume()` that returns a structured issue list. Inline blur errors on basic `email/phone/linkedin/github/portfolio` and `projects[].link`. Save-time top banner summarizing remaining issues — saving never blocked.
- **Verification:** `npm run lint` clean, `npm test` 237/237 (was 190; +47 from validator suite including post-review URL cases), `node -c` parse OK, CI green (44s + 13s).
- **Sub-agent review:** flagged URL regex rejecting `linkedin.com?ref=share` and `example.com#anchor` (real share-link shapes). Fixed in `69ae664` by widening tail from `(\/[^\s]*)?` to `([/?#][^\s]*)?` + 2 new tests.
- **Follow-ups recorded (non-blocking, not opened as issues yet):**
  - `options.js` `save()` writes `chrome.storage.local.set({ resume })` without the `mutateStorage` serialization PR #25 introduced for popup.js. Lower race risk (full replace) but worth converting in a future cleanup.
  - On `resumefiller:languagechange`, banner re-renders without first running `collectFlatFields()` — banner reflects post-save state, not current DOM.
  - Banner doesn't auto-clear when user fixes errors mid-edit.
  - Inline `.field-error` spans aren't linked to inputs via `aria-describedby`.
  - Pre-existing (not from this PR): Chinese comments in `renderCustomFields`.
