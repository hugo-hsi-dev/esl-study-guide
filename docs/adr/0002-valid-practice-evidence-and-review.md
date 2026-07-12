# 0002: Require valid modality, independent evidence, and scheduled review

Date: 2026-07-11

Status: Accepted

## Context

A study counter can look productive while measuring the wrong construct. Reading a listening script,
typing a speaking script, choosing a sentence about fluency, or repeating one memorized item does not
provide the same evidence as listening, speaking, or applying a skill to new content. Immediate drills
also do not show that learning lasted.

## Decision

- Listening evidence requires real decodable audio plus an owned playback acknowledgement. A preload or
  audio URL request alone does not count.
- Writing targets require a written productive response. Speaking targets require audio-derived
  transcription; a learner-typed script is saved as unscored practice. Pronunciation remains unscored.
- Practice selection preserves both area and error signal, and difficulty advances only after correct
  responses to two distinct items at the same level.
- Reassessment counts at most two exposures to one content ID and requires evidence from more than one
  problem in every active Study Plan target, including maintenance coverage for assessed areas. It also
  requires distributed target coverage and completed sessions.
- Correct responses schedule the next review after 1, 3, 7, and then 14 days as distinct correct content
  accumulates. A miss becomes due immediately and receives one different-content repair problem.
- When a future test date is known, the weekly session target is calculated from the remaining evidence
  and sessions before that date. It remains a study pace, not a pass forecast.

## Consequences

Some responses are honestly saved without changing adaptation or reassessment readiness. Provider or
audio failures fail closed. Learners may need more total attempts than the visible evidence threshold if
they repeat the same content, but the progress view explains distinct-content coverage. These rules make
progress slower than a raw problem counter and more defensible as study evidence.
