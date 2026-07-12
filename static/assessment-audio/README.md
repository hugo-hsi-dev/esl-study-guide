# Versioned listening fixtures

These WAV files provide real spoken English when the assessment runs without a
text-to-speech binding. They replace the former 0.2-second tone, which was not
valid listening evidence.

| Item | Voice | Rate | Script | Duration |
| --- | --- | --- | --- | --- |
| `listen-mei-coworker-time` | Samantha (`en_US`) | 165 wpm | I will meet my coworker at eight fifty near the station. | 3.08 s |
| `listen-ana-pharmacy-main-idea` | Karen (`en_AU`) | 165 wpm | The pharmacy closes at seven, so I need to pick up my medicine after work. | 4.72 s |
| `listen-bus-platform-detail` | Daniel (`en_GB`) | 165 wpm | Attention please. The number twenty-four bus to Green Street will leave from platform six. | 5.43 s |
| `accu-listen-aid-deadline` | Samantha (`en_US`) | 160 wpm | Campus financial-aid workshop change and deadline. | 18.44 s |
| `accu-listen-urban-trees-purpose` | Samantha (`en_US`) | 160 wpm | Short lecture about urban-tree benefits and planning. | 26.52 s |
| `cept-listen-tutorial-change` | Daniel (`en_GB`) | 160 wpm | Extended bicycle-route study, detail question (form A). | 39.35 s |
| `cept-listen-bicycle-study` | Daniel (`en_GB`) | 160 wpm | Extended report on protected routes and student cycling. | 39.35 s |
| `listen-lee-clinic-time-b` | Samantha (`en_US`) | 165 wpm | Clinic appointment change (form B). | 5.05 s |
| `listen-nora-package-main-idea-b` | Karen (`en_AU`) | 165 wpm | Package pickup message (form B). | 5.21 s |
| `listen-airport-train-track-b` | Daniel (`en_GB`) | 165 wpm | Airport-train platform announcement (form B). | 4.96 s |
| `accu-listen-registration-room-b` | Samantha (`en_US`) | 160 wpm | Connected registration help-desk directions (form B). | 20.35 s |
| `accu-listen-reusable-containers-purpose-b` | Samantha (`en_US`) | 160 wpm | Lecture on effective reusable-container programs (form B). | 30.61 s |
| `cept-listen-lab-change-b` | Daniel (`en_GB`) | 160 wpm | Extended part-time study report, detail question (form B). | 36.17 s |
| `cept-listen-part-time-study-b` | Daniel (`en_GB`) | 160 wpm | Extended part-time study report, conclusion question (form B). | 36.17 s |

Each CEPT form uses one identical reviewed WAV for its consecutive detail and
main-conclusion questions. The two item-specific files in each pair are byte
identical so the learner hears one stable stimulus while the item lifecycle can
still acknowledge and authorize each response independently.

Generation command shape:

```sh
say -v <voice> -r <rate> -o /tmp/<item>.aiff '<script>'
afconvert -f WAVE -d LEI16@22050 /tmp/<item>.aiff static/assessment-audio/<item>.wav
```

Before replacing a fixture, verify that it is mono 22.05 kHz PCM, has non-zero
audio packets, lasts at least two seconds, and matches the versioned server-only
script. Production may still use Workers AI TTS, but a failed TTS request must
fail closed rather than serve non-speech audio.
