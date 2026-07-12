# 0001: Treat the assessment as a quick placement-readiness baseline

Date: 2026-07-11

Status: Accepted

## Context

The learner wants study guidance for an ESL placement test, but placement tests differ by provider
and institution. The readiness baseline has not been calibrated against an official
score scale, a course-placement rule, or CEFR standard setting. Calling its internal bands a placement
score or pass prediction would therefore overstate the evidence.

Historical assessment attempts store an intake without placement-test context and store the field
name `diagnosisQuality` in completed Skill Profiles.

## Decision

- The learner-facing assessment is a **quick readiness baseline** that chooses practice priorities.
- Intake records a backward-compatible `PlacementTestProfile`: test kind, institution, target
  course or outcome, known section names, and optional test date. Unknown details remain valid and
  are represented by the `not_sure` kind.
- The supported test kinds are ACCUPLACER ESL, Cambridge English Placement Test (CEPT), a
  school-specific test, and not sure.
- Internal Skill Bands remain practice-routing labels. They are not official scores, CEFR levels, or
  predictions that the learner will pass or enter a particular course.
- Named ACCUPLACER ESL and CEPT baselines use profile-specific intermediate and challenge probes;
  each full form has three common foundation, one intermediate, and one challenge response in each
  selected objective study area. The general baseline remains shorter. The highest internal band
  requires at least four of five correct plus both upper-tier responses, and cannot be earned from
  the introductory items alone.
- Explicit section names narrow the form using provider-specific mappings. ACCUPLACER Sentence
  Meaning, Language Use, Reading Skills, and Listening map to separate internal study areas. CEPT
  Reading maps to reading, grammar/usage, and vocabulary task families; CEPT Listening maps to
  listening. Recognized school-specific section names select only the matching general tasks.
- ACCUPLACER WritePlacer ESL preparation is optional and separate from the 20-question objective
  core. When requested, the form adds one original 300–600-word prompt with an internal 0–3
  readiness review; the product never presents that review as an official 1–6 WritePlacer ESL score.
- Every supported selection has two independently authored and reviewed forms, A and B. A learner’s
  first baseline uses A; each later baseline uses the form not used by their latest completed attempt.
  Item IDs never overlap across forms, including explicit-section selections and optional WritePlacer
  readiness, so an immediate reassessment cannot reward memorized corrections.
- New attempts persist `formId` beside each selected item. Older attempts derive A/B from the
  immutable versioned item when the stored field is absent; a mixed or contradictory form is rejected.
- Each CEPT form uses a consecutive two-question extended-listening set (supporting detail, then main
  conclusion) over one identical audio stimulus and a three-question extended-reading set over one
  identical passage. Shared foundation items continue to provide short listening and reading probes.
- The persisted `diagnosisQuality` field remains unchanged for stored-data compatibility. The UI
  describes it as **evidence coverage**: whether all baseline areas returned reviewable evidence.
- Missed objective responses and their reviewed explanations are shown after completion so the
  assessment produces an actionable study handoff.
- The Study Plan retains at most three evidence-based priority weaknesses, with no more than one
  active target per area. Every other assessed profile area receives a stable maintenance target:
  listening detail, reading main idea, grammar verb form, vocabulary in context, writing sentence
  control, or speaking clarity. A plan therefore covers all assessed profile areas, up to six, rather
  than dropping strong areas when weaknesses are present.

## Consequences

The application can personalize future practice and exam-format work using the recorded target
without claiming an unsupported equivalence. Historical intake and stored one-to-three-target Study
Plans remain readable; new plans may contain up to six targets. Any future official-score readiness
claim requires a test-specific blueprint, parallel item forms, representative piloting, calibrated
scoring, and validation against the score use being claimed.
