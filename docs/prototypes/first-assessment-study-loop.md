# First assessment and study loop prototype

Date: 2026-07-08

Status: rough HITL prototype asset for
[Prototype the first assessment and study loop](https://github.com/hugo-hsi-dev/esl-study-guide/issues/5).
This is a storyboard, not implementation.

## Question

What should the Learner's first complete loop feel like: assessment entry,
question flow, result explanation, and targeted study recommendation?

## Inputs from resolved tickets

- The Learner is one young adult Chinese-literate English learner with uneven
  beginner skills.
- The ESL Assessment is a gateway into study, not a test-prep product.
- The first pass covers listening, reading, writing, speaking, grammar/usage,
  and vocabulary.
- The Skill Diagnosis uses Skill Bands and observed Error Signals, not CEFR or a
  single score.
- Chinese L1 transfer targets become Error Signals only when answers show them.
- The useful output is a short Skill Profile, a Study Plan, and immediate
  Adaptive Practice.

## Loop storyboard

### 1. Entry

Screen title: `Find what to practice first`

Body copy:

> Answer a few short questions. You will get a simple skill profile and one
> practice problem to start.

Controls:

- `Start`
- `I only have 10 minutes` toggle

Learner state shown after start:

```json
{
	"stage": "assessment",
	"completedAreas": [],
	"errorSignals": []
}
```

### 2. Intake

One short self-rating screen:

- `Speaking`: hard / ok / comfortable
- `Reading`: hard / ok / comfortable
- `Writing`: hard / ok / comfortable
- `Goal this month`: daily life / work / school / travel

Use this to tune examples, not to score the Learner.

### 3. Assessment flow

Keep one task type per area. Show progress by area, not by grade.

| Area          | Prototype task                           | Example                                                                             | Signals to capture                                                                                                                  |
| ------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Listening     | Short audio, two comprehension choices   | `What time will Mei meet her coworker?`                                             | main idea, detail                                                                                                                   |
| Reading       | Short passage, two comprehension choices | `Why did the customer return the shoes?`                                            | main idea, detail, vocabulary-in-context                                                                                            |
| Grammar/usage | Fill in the blank                        | `She ____ to work every morning.` -> `go / goes / going`                            | verb form, subject-verb agreement                                                                                                   |
| Vocabulary    | Word in context                          | `The train was delayed, so I arrived late.` What does `delayed` mean?               | word meaning, collocation                                                                                                           |
| Writing       | Short paragraph                          | `Write 4-5 sentences about a problem you solved last week.`                         | articles, plurals, tense, sentence control, clarity                                                                                 |
| Speaking      | Recorded short answer                    | `Tell me about something you bought recently. What was it, and why did you buy it?` | Workers AI transcription plus transcript-level task completion, clarity, grammar/control, vocabulary misuse, and fluency indicators |

Question screen pattern:

```text
[Area label] Reading
[Progress] 2 of 6 areas

Read:
"Lina bought a jacket online. It was too small, so she sent it back..."

Question:
Why did Lina return the jacket?

[choice] It was too expensive.
[choice] It was too small.
[choice] It arrived late.
```

### 4. Skill Profile

Show the result as a study handoff, not a score page.

```text
Your first skill profile

Listening: developing
Reading: functional
Grammar/usage: emerging
Vocabulary: developing
Writing: emerging
Speaking: developing

Practice first:
1. Verb forms in simple daily sentences
2. Articles and plural nouns
3. Short sentence control when writing
```

Missed-answer explanation:

```text
You wrote: "She go to office every day."

Try: "She goes to the office every day."

Why:
"She" needs "goes" in the present tense. "Office" usually needs "the" when you
mean a known workplace.

Signals:
verb form, article/determiner
```

### 5. Study Plan

Keep it short enough to act on immediately.

```text
Today
- 5 verb-form practice problems
- 3 article/plural practice problems
- Rewrite one short paragraph

This week
- Practice daily-life sentences
- Recheck grammar/usage after 20 practice answers
```

### 6. First Adaptive Practice problem

Generated from the top Error Signal, not from a generic lesson list.

```text
Focus: verb forms

Choose the best sentence:

A. He work in a restaurant.
B. He works in a restaurant.
C. He working in a restaurant.

[Check]
```

After answer:

```json
{
	"stage": "practice",
	"focus": "verb form",
	"recentAnswer": "B",
	"nextAction": "give harder daily-life sentence if correct; give one more simple present item if missed"
}
```

## Prototype decision

The first complete loop should feel like a short diagnostic handoff into study:
the Learner starts with a plain promise, answers one simple task per assessed
area, sees separate Skill Bands with concrete missed-answer examples, then
starts one Adaptive Practice problem targeted to the strongest observed Error
Signal. Defer pronunciation scoring, a dedicated speech-scoring provider, a full
curriculum, a placement score, and polished analytics.
