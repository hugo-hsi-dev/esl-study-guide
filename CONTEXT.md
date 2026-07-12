# ESL Placement Study Guide

Domain language for an exam-aligned ESL placement study tool for a Chinese-literate learner.

## Language

**Learner**:
A single young adult Chinese-literate English learner with uneven beginner skills: usable basic spoken English, but heavy difficulty with grammar, pronunciation, reading comprehension, and writing beyond a few sentences. The MVP is not planned for broader learner segments.
_Avoid_: Student, user, generic ESL learner

**Admin**:
The owner account that can view the learner's assessment and study data in a read-only way for MVP support and progress review.
_Avoid_: Teacher, tutor, content editor

**Skill Diagnosis**:
A quick, low-stakes readiness baseline that identifies current strengths and weaknesses so the tool can choose what to teach and practice next. It reports bounded evidence, not an official placement result.
_Avoid_: Official placement, pass prediction, certified grade, exam score

**Placement Test Profile**:
The Learner's selected target test and context: provider or school-specific test, institution, target course or outcome, optional test date, covered sections, and task-format guidance. If the exact test is unknown, the profile stays general and the product makes narrower claims.
_Avoid_: Assuming every ESL placement test has one universal blueprint

**ESL Assessment**:
A short readiness baseline covering the sections relevant to the Placement Test Profile so the tool can build an exam-aligned study path. It is a gateway into teaching and practice, not a substitute for the institution's official placement test.
_Avoid_: Official test, pass/fail verdict, universal placement score

**Speaking Feedback**:
MVP speaking feedback uses Workers AI transcription plus transcript-level surface analysis for grammar errors, vocabulary misuse, clarity, task completion, and related observable issues. Pronunciation scoring is deferred.
_Avoid_: Pronunciation score, dedicated speech-scoring provider

**Skill Profile**:
A lightweight post-assessment summary of bounded section evidence, priority weaknesses, missed-answer corrections, confidence limits, and plain-language explanations tied to the Placement Test Profile.
_Avoid_: Grade level, uncalibrated CEFR score, report card, pass prediction

**Skill Band**:
An internal practice-routing label for one assessed area, such as emerging, developing, functional, or strong. Learner-facing copy pairs it with evidence count and confidence and never presents it as an official placement classification.
_Avoid_: CEFR equivalence, IELTS score, TOEFL score, institution cut score

**Error Signal**:
A tagged pattern from assessment answers, such as article use, plurals, tense, prepositions, pronoun choice, sentence control, or collocation. Error signals guide practice without assuming an error based on the learner's first language.
_Avoid_: Stereotype, fixed L1 weakness

**Assessment Item**:
A reviewed prompt, answer key or rubric, explanation, error-signal tags, placement profile, task format, and difficulty tier used in the ESL assessment. Named profiles include intermediate and challenge probes; a perfect introductory set alone cannot produce the highest internal band.
_Avoid_: Question, imported worksheet, generated quiz

**Assessment Form**:
One complete reviewed set of Assessment Items for a Placement Test Profile. The first baseline uses Form A and the next completed-attempt reassessment uses zero-overlap Form B, so disclosed corrections do not become the next score evidence.
_Avoid_: Reusing memorized baseline items, mixing form identities in one attempt

**AI Content Review**:
A separate AI review pass for assessment content where the reviewing session did not author the content being reviewed.
_Avoid_: Human review, self-review

**Study Plan**:
A short, structured set generated from the Skill Profile. It keeps at most three evidence-based priority weaknesses and adds a maintenance target for every other assessed Placement Test Profile area, up to six active area targets. A readiness check is invited only after distributed, independent evidence across all active targets.
_Avoid_: Unstructured problem counter, official course syllabus

**Diagnosis Quality**:
Legacy stored field indicating whether every planned response received usable scoring evidence. Learner-facing copy calls this **Evidence Coverage**, because complete coverage does not imply a reliable or validated placement diagnosis. An area with no defensible evidence is shown as `insufficient evidence`, never guessed from response length or background.
_Avoid_: Quality guarantee, silent fallback, estimated score

**Study Session**:
A resumable set of five Exam-Aligned Practice problems that combines a short rule or strategy, a worked example, independent response, corrective feedback, and later review. It preserves the modality of the selected target, covers untouched plan targets before returning to a twice-practiced weakness, and uses a new content example for an immediate retry. When the Learner provides a future test date, the weekly session target is paced from the remaining evidence and sessions before that date; otherwise the default target is five.
_Avoid_: Random quiz, streak, course unit

**Progress Summary**:
A derived view of recent scored Practice Problems, completed Study Sessions, Skill Profile history, and reassessment readiness. It is calculated from attempts rather than stored as a separate mastery score.
_Avoid_: Grade, permanent mastery level

**Practice Problem**:
A targeted exercise selected to improve one diagnosed skill weakness.
_Avoid_: Lesson, course unit, worksheet

**Adaptive Practice**:
Exam-aligned problems selected or generated in response to the confirmed sections of the Placement Test Profile, observed error, current evidence, prior exposure, and review timing. Practice must preserve modality: objective profile areas stay objective, listening evidence requires completed audio playback, writing targets require writing, speaking targets require audio, and typed text never counts as speaking evidence.
_Avoid_: Generic English trivia, static drill set, modality substitution, uncalibrated AI grading

**MVP AI Provider**:
The MVP AI path uses Workers AI catalog models directly through the Worker AI binding or REST `ai/run`, with configurable model IDs for text feedback/generation, transcription, and text-to-speech. When Workers AI bindings or credentials are absent, local and test paths use deterministic stubs.
_Avoid_: AI Gateway rerouting, direct provider SDK, direct provider API key, dedicated speech-scoring credential
