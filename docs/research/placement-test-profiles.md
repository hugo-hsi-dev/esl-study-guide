# ESL placement-test profiles

Date: 2026-07-11

## Decision question

What must the product know before it can claim that practice is aligned to an
ESL placement test?

## Finding

There is no single universal ESL placement-test blueprint or universal “pass.”
The tool must capture the learner's provider or institution and keep practice,
section labels, timing, and readiness claims scoped to that profile. When the
exact test is unknown, the tool should provide a general readiness baseline and
ask the learner to confirm the school-specific sections and placement rules.

## Built-in profiles

### ACCUPLACER ESL

The official ACCUPLACER ESL materials describe four multiple-choice tests:
Sentence Meaning, Language Use, Reading Skills, and Listening. College Board's
standard-setting guide describes 20 questions per ESL multiple-choice test and
explains that institutions set the cut scores used for course placement. The
optional WritePlacer ESL task asks for an essay of approximately 300–600 words
and reports a 1–6 score (or zero for a response that cannot be evaluated).

Product implications:

- Match section names and practice constructs to the four official sections.
- Treat writing preparation as a separate, extended task rather than a short
  paragraph score.
- Do not predict a course placement until the learner supplies the institution's
  placement rule, and do not present practice accuracy as an ACCUPLACER score.
- Use original, exam-style practice content; never copy released sample items.

Implemented readiness form: three common foundation items plus one original intermediate and one
original challenge item for each selected objective section. A blank section list uses all four
objective sections (20 tasks); explicit section names narrow the form. WritePlacer ESL adds one
separate 300–600-word prompt and only an internal 0–3 readiness review.

### Cambridge English Placement Test (CEPT)

Cambridge describes CEPT as a computer-based, adaptive Reading and Listening
test that also covers Language Knowledge. Its current task guide includes
read-and-select, gapped sentences, multiple-choice gap-fill, open gap-fill,
extended reading, listen-and-select, and extended listening. Cambridge says a
typical test takes about 30 minutes, while the exact question count varies with
the adaptive stopping criteria.

Product implications:

- Include four-option gap-fill and open-gap tasks, not only three-option cloze.
- Include extended reading and extended listening sets with ordered questions.
- Use multiple English accents and international contexts.
- Keep any CEFR estimate out of the product until the content and scoring have
  been benchmarked against CEPT outcomes.

Implemented readiness form: five listening tasks and fifteen tasks under the CEPT Reading umbrella
(reading comprehension, grammar/usage, and vocabulary). Explicit Listening or Reading section names
narrow the form; a blank section list uses all 20 tasks. The upper tier includes listen-and-select,
extended listening, read-and-select, extended reading, four-option gaps, and an open gap.

### School-specific or unknown

The learner supplies the institution, target course or outcome, test date, and
any known sections. The product uses a general ESL readiness blueprint until the
school's current format and placement rules are confirmed.

## Shared content requirements

Every practice or baseline item should declare:

- placement-test profile and section;
- modality (audio, written text, or productive response);
- construct and subskill;
- task type and difficulty;
- answer rationale and distractor rationales;
- exposure/version information;
- review status and accessibility requirements.

Listening evidence requires real, decodable speech. Typed text must never update
a listening or speaking evidence bucket. A quick baseline may route practice,
but it must report evidence counts and low-confidence limits instead of an
official placement or pass prediction.

## Official sources

- College Board, [ACCUPLACER ESL test sample and section descriptions](https://accuplacer.collegeboard.org/accuplacer/pdf/accuplacer-esl-tests-sample-questions.pdf).
- College Board, [ACCUPLACER standard-setting guide](https://accuplacer.collegeboard.org/accuplacer/pdf/guide-to-next-generation-standard-setting.pdf).
- College Board, [WritePlacer ESL guide and scoring samples](https://accuplacer.collegeboard.org/accuplacer/pdf/accuplacer-writeplacer-esl-sample-essays.pdf).
- Cambridge English, [CEPT question types](https://support.cambridgeenglish.org/hc/en-gb/articles/360000241043-Cambridge-English-Placement-Test-CEPT-Types-of-CEPT-Questions).
- Cambridge English, [CEPT frequently asked questions](https://support.cambridgeenglish.org/hc/en-gb/articles/210044206-Cambridge-English-Placement-Test-CEPT-FAQs).
