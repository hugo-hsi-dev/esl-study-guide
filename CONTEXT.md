# ESL Study Guide

Domain language for an ESL assessment study tool for a Chinese-literate learner.

## Language

**Learner**:
A single young adult Chinese-literate English learner with uneven beginner skills: usable basic spoken English, but heavy difficulty with grammar, pronunciation, reading comprehension, and writing beyond a few sentences. The MVP is not planned for broader learner segments.
_Avoid_: Student, user, generic ESL learner

**Admin**:
The owner account that can view the learner's assessment and study data in a read-only way for MVP support and progress review.
_Avoid_: Teacher, tutor, content editor

**Skill Diagnosis**:
An assessment result that identifies the learner's current strengths and weaknesses so the tool can choose what to practice next.
_Avoid_: Placement, grading, exam score

**ESL Assessment**:
A broad diagnostic flow covering listening, reading, writing, speaking, grammar/usage, and vocabulary so the tool can build a study path. It is a gateway into study and a periodic check-in, not the whole product.
_Avoid_: Practice test app, exam prep test

**Speaking Feedback**:
MVP speaking feedback uses Workers AI transcription plus transcript-level surface analysis for grammar errors, vocabulary misuse, clarity, task completion, and related observable issues. Pronunciation scoring is deferred.
_Avoid_: Pronunciation score, dedicated speech-scoring provider

**Skill Profile**:
A lightweight post-assessment summary of the learner's skill bands, priority weaknesses, missed-answer examples, and plain-language explanations.
_Avoid_: Grade level, CEFR score, report card

**Skill Band**:
An internal level label for one assessed area, such as emerging, developing, functional, or strong.
_Avoid_: CEFR equivalence, IELTS score, TOEFL score

**Error Signal**:
A tagged pattern from assessment answers, such as article use, plurals, tense, prepositions, pronoun choice, sentence control, or collocation. Error signals guide practice without assuming an error based on the learner's first language.
_Avoid_: Stereotype, fixed L1 weakness

**Assessment Item**:
A reviewed prompt, answer key or rubric, explanation, and error-signal tags used in the ESL assessment.
_Avoid_: Question, imported worksheet, generated quiz

**AI Content Review**:
A separate AI review pass for assessment content where the reviewing session did not author the content being reviewed.
_Avoid_: Human review, self-review

**Study Plan**:
A short, structured set of priority skill weaknesses and next practice targets generated from the Skill Profile. The Learner is invited to reassess after 20 scored practice responses.
_Avoid_: Full curriculum, course syllabus

**Diagnosis Quality**:
Whether the Skill Profile has full evidence or limited evidence because a writing/speaking rubric could not be produced. An area with no defensible evidence is shown as `insufficient evidence`, never guessed from response length or background.
_Avoid_: Silent fallback, estimated score

**Study Session**:
A resumable set of five Adaptive Practice problems: four quick responses and one productive writing or speaking response. The weekly goal is five completed Study Sessions.
_Avoid_: Lesson, streak, course unit

**Progress Summary**:
A derived view of recent scored Practice Problems, completed Study Sessions, Skill Profile history, and reassessment readiness. It is calculated from attempts rather than stored as a separate mastery score.
_Avoid_: Grade, permanent mastery level

**Practice Problem**:
A targeted exercise selected to improve one diagnosed skill weakness.
_Avoid_: Lesson, course unit, worksheet

**Adaptive Practice**:
Practice problems generated on demand by AI in response to the learner's skill diagnosis and recent answers.
_Avoid_: Static drill set, full curriculum, AI grading

**MVP AI Provider**:
The MVP AI path uses Workers AI catalog models directly through the Worker AI binding or REST `ai/run`, with configurable model IDs for text feedback/generation, transcription, and text-to-speech. When Workers AI bindings or credentials are absent, local and test paths use deterministic stubs.
_Avoid_: AI Gateway rerouting, direct provider SDK, direct provider API key, dedicated speech-scoring credential
