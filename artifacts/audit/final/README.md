# Final student audit — 2026-07-11

## Verdict

Clean with two convenience nits. Independent final re-audits returned CLEAN for
assessment validity, CLEAN for engineering/regression safety, and NITS for the student
journey. No blocking, major, or moderate finding remains. The project now provides a
complete, evidence-bounded placement-preparation loop: identify the learner's actual
test and sections, complete a reviewed readiness form, understand corrections, study
every diagnosed target with adaptive lessons and spaced review, see the evidence
required for another baseline, and use a fresh zero-overlap form only when
reassessment is useful.

This is intentionally a study tool, not an official placement instrument. It does not
claim an official ACCUPLACER, Cambridge, CEFR, school placement, pass prediction, or
pronunciation score. The learner's school remains the source of required sections,
cut scores, placement rules, accommodations, and retest policy.

## Final walkthrough

1. **Profile intake and scope — healthy.** Learners can select ACCUPLACER ESL,
   Cambridge CEPT, or a school-specific/unknown test; record their institution,
   target course, known sections, and test date; and see those sections structurally
   control the readiness form and later practice. Evidence:
   [ACCUPLACER profile intake](21-accu-profile-top.jpg).
2. **Reviewed readiness forms — healthy.** Named profiles use reviewed Form A/Form B
   banks with zero item-ID overlap, fail closed when no undisclosed form remains, and
   show the active profile and form. ACCUPLACER objective tasks expose four choices.
   Evidence: [ACCUPLACER reviewed Form B](23-accu-form-b-four-choice.jpg).
3. **Current CEPT task families — healthy.** A fresh post-repair 15-task CEPT Reading
   walkthrough confirmed a three-choice notice whose answer is the sentence that most
   closely matches its meaning, four-choice gapped and multiple-choice gap-fill items,
   a typed open gap, and a three-question linked extended-reading series based on one
   shared passage. Evidence:
   [current four-choice CEPT gap](25-cept-current-four-choice-gap.jpg).
4. **Evidence-bounded profile — healthy.** Internal bands require sufficient reviewed
   evidence and challenge evidence, report only assessed areas, explain their limits,
   and create a study target for every evidenced need. Unscored productive responses
   never inflate mastery. Evidence: [current CEPT results](26-cept-current-results.jpg).
5. **Actionable corrections — healthy.** Missed items preserve the versioned
   stimulus, question, learner response, expected response, explanation, and practice
   focus. Listening corrections can replay the original audio, with the transcript
   available only after completion. Evidence:
   [corrections with context](22-accu-corrections-with-context.jpg).
6. **Placement-specific adaptive practice — healthy.** Five-problem sessions teach
   the diagnosed signal first, use alternate foundation tasks when needed, rotate
   untouched targets into the session, reject repeated AI content by stable content
   fingerprint, and schedule review at 1/3/7/14-day intervals. CEPT daily practice
   uses explicit reviewed format metadata: the post-repair browser walkthrough showed
   a short Route 8 notice, the instruction to choose the sentence that most closely
   matches its meaning, and three choices under “Test-style task: read and select.”
   Generic and AI-generated exercises say “Targeted skill drill.” Evidence:
   [adaptive recap](11-clean-adaptive-session-recap.jpg).
7. **Authentic listening and bounded productive evidence — healthy.** Every reachable
   built-in listening task has a real WAV asset, playback must be acknowledged before
   saving, and missing audio fails closed. Typed or transcribed speaking and writing
   feedback is limited to observable language evidence and explicitly excludes
   pronunciation scoring. Evidence: [speaking boundary](18-speaking-boundary.jpg),
   [productive evidence bounds](19-writing-speaking-evidence-bounds.jpg).
8. **Progress and honest reassessment — healthy.** Progress shows target coverage,
   distinct-content evidence, scored-response and session requirements, and whether
   the same target or another baseline is available. The same target cannot consume
   Form B before practice recommends reassessment. Evidence:
   [evidence progress](13-evidence-progress.jpg).
9. **Current test guide — healthy.** ACCUPLACER and CEPT are separated; CEPT is
   described as Reading and Listening with language knowledge inside Reading;
   extended tasks are linked series; daily drills are not mislabeled as extended
   tasks; and official-provider resources plus a school-confirmation checklist are
   included. Evidence: [current test guide](24-current-test-guide.jpg).

## Findings repaired during re-audit

- Replaced global three-choice CEPT projection with task-family-specific choice
  counts and retained authored correct answers.
- Added dedicated, reviewed, zero-overlap CEPT Form A/B read-and-select notices and
  replaced signal-based daily labels with explicit task-family metadata plus semantic
  validation. Generic comprehension and AI-generated objectives are now targeted
  skill drills rather than claimed CEPT replicas.
- Expanded both CEPT forms to three-question linked extended-reading series.
- Added an explicit inference signal end to end, including foundation and challenge
  practice, diagnosis, progress, and guide copy.
- Made CEPT daily-practice labels content-specific and added a neutral targeted-drill
  label for exercises that are useful but not official-format replicas.
- Added deterministic duplicate-content rejection for AI-generated practice.
- Made reassessment thresholds achievable for one- and two-target plans while still
  requiring distinct content, repeated evidence, and completed sessions.
- Added the four missing practice-listening WAVs and exhaustive reachability/RIFF
  validation for all twelve built-in listening assets.
- Restored complete correction context and post-completion listening replay without
  exposing answers or scripts during an active attempt.
- Prevented learners from spending the same-target alternate form until Progress
  recommends reassessment, including when another target was completed in between,
  while keeping a genuinely different valid baseline available after a profile or
  section change.
- Bound each reassessment recommendation to its source assessment attempt and
  normalized profile/section target. Practice readiness earned for an interposed
  target can no longer authorize an older target's alternate form.
- Made the school-unknown profile honor recognized typed sections while retaining the
  full general baseline when the section text contains no recognized area.
- Fixed item DOM identity, section leakage, generic productive-task forcing, target
  starvation, and date-only deadline rendering found in the first student re-audit.

## Verification record

- `pnpm check`: 0 errors and 0 warnings
- `pnpm lint`: passed (Prettier and ESLint)
- Server tests: 159/159 passed across 11 files
- Browser component tests: 1/1 passed
- Workers integration tests: 2/2 passed
- Playwright end-to-end tests: 6/6 passed, 1 release-only smoke skipped by design
- Production build: passed
- Forbidden Svelte syntax scan: no `{#await}` or `{@const}` in routes/library
- `git diff --check`: passed
- Fresh local walkthroughs: ACCUPLACER Form A completion and Form B identity/choice
  check; post-semantic-repair CEPT Reading Form A completion across all 15 tasks; and
  CEPT daily read-and-select generation with exact meaning-match semantics

## Accuracy basis and evidence limits

The implementation is aligned to the current official descriptions for
[ACCUPLACER ESL test content](https://accuplacer.collegeboard.org/educators/whats-on-tests),
the [College Board ESL test descriptions](https://accuplacer.collegeboard.org/accuplacer/pdf/esl-test-descriptions.pdf),
and [Cambridge CEPT question types](https://support.cambridgeenglish.org/hc/en-gb/articles/360000241043-Cambridge-English-Placement-Test-CEPT-Types-of-CEPT-Questions).

The live audit establishes that the visible workflow, routing, persistence, bounded
feedback, section alignment, adaptive selection, audio availability, and
reassessment behavior work for the audited local learners. It does not establish
psychometric calibration, institution-specific cut-score prediction, official
provider endorsement, or pronunciation scoring. Those require provider/institution
data and a separate validation study.

## Independent final re-audit

- **Assessment validity: CLEAN.** Reviewed task families, semantic labels, evidence
  bounds, audio boundaries, zero-overlap forms, and finite target-specific
  reassessment all passed.
- **Engineering/regression safety: CLEAN.** No answer/script leakage, cross-target
  authorization, missing-audio path, unscored mastery inflation, duplicate-content
  escape, or form-exhaustion regression remains.
- **Student journey: NITS.** Typed section names do not show a parsed-scope preview
  before the form begins, and a long baseline does not have a separate review-all
  answers screen. Both are convenience improvements; saved navigation, correction
  review, validity, and completion are unaffected.
