# Baseline student audit — 2026-07-11

## Audit scope

Combined UX, learning-efficacy, and accessibility review of the signed-out entry,
learner sign-in, empty study home, assessment intake, objective tasks, writing task,
and speaking task. The learner goal used in the walkthrough was: “Pass my college
ESL placement test and place into credit-bearing English.”

## Verdict

Not clean. The experience is a thoughtful diagnostic prototype, but it does not yet
function as a placement-test study tool. The live walkthrough also found three
journey-breaking validity bugs: invalid fallback listening audio, answers carrying
between tasks, and a speaking form that cannot submit.

## Steps

1. **Landing — needs work.** Clear and calm, but it promises generic improvement and
   does not explain test alignment, teaching method, or the limits of its score.
   Evidence: [01-landing.jpg](01-landing.jpg).
2. **Sign in — healthy with minor accessibility risk.** The task is simple and labels
   are clear. Error announcements and return-to-deep-link behavior still need testing.
   Evidence: [02-login.jpg](02-login.jpg).
3. **Empty learner home — structurally healthy, strategically unclear.** The primary
   action is obvious, but the dashboard tracks sessions and reassessment counts rather
   than test sections, target course, or readiness evidence.
   Evidence: [03-study-home.jpg](03-study-home.jpg).
4. **Assessment intake — major scope gap.** It captures a free-text goal and three
   self-ratings, but not the target test, institution, desired course/score, or test
   date. A learner cannot tell what the assessment is aligned to.
   Evidence: [04-assessment-intake.jpg](04-assessment-intake.jpg).
5. **First listening task — invalid in the audited environment.** The audio control
   reports `0:00`; the fallback is a short tone, not speech. The answer is still
   accepted as listening evidence.
   Evidence: [05-assessment-task.jpg](05-assessment-task.jpg).
6. **Next objective task — journey-breaking.** The answer position selected on the
   previous item appears selected on the new item before the learner answers. This can
   submit unintended responses and invalidate the diagnosis.
   Evidence: [06-next-answer-preselected.jpg](06-next-answer-preselected.jpg).
7. **Writing task — usable but too shallow for placement preparation.** The prompt is
   approachable, yet four or five sentences cannot support the broad writing claims or
   approximate common college-placement essay demands.
   Evidence: [07-writing-task.jpg](07-writing-task.jpg).
8. **Speaking task — blocked.** Recording affordances are clear, but the enhanced form
   is missing multipart encoding, so even the transcript fallback cannot be saved. A
   typed transcript is also not valid evidence of speaking delivery.
   Evidence: [08-speaking-task.jpg](08-speaking-task.jpg).

## Highest-impact changes

1. Add an explicit placement-test profile and keep all result claims bounded to that
   profile and the evidence actually collected.
2. Replace the non-speech fallback with versioned real speech or fail the item closed.
3. Reset controls between items and repair multipart speaking submission.
4. Turn practice into a teaching loop: rule, worked example, guided problem,
   correction, retry, and delayed review.
5. Preserve section and modality in all practice/progress evidence; listening requires
   audio and typed text never becomes speaking evidence.
6. Show the learner their answer, the correct answer, why it works, evidence count,
   confidence limit, and exact next target.

## Evidence limits

Screenshots support visible hierarchy, copy, control state, and the observed flow bugs.
They do not establish WCAG conformance, psychometric reliability, audio intelligibility,
or productive-response scoring validity. Code and test inspection was used for those
additional risks; final acceptance still requires keyboard, responsive, audio, and
repeat-assessment checks after implementation.
