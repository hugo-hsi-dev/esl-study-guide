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
A short set of priority skill weaknesses and next practice targets generated from the skill profile.
_Avoid_: Full curriculum, course syllabus

**Practice Problem**:
A targeted exercise selected to improve one diagnosed skill weakness.
_Avoid_: Lesson, course unit, worksheet

**Adaptive Practice**:
Practice problems generated on demand by AI in response to the learner's skill diagnosis and recent answers.
_Avoid_: Static drill set, full curriculum, AI grading
