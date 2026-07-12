# Versioned listening-practice fixtures

These WAV files are the real-speech fallback for the reviewed local listening
bank. The problem ID is the filename stem. AI-generated listening problems still
use Workers AI TTS and fail closed when speech cannot be produced.

The fixtures use 165 wpm system voices from several English locales (US, UK,
Australia, Ireland, India, and South Africa) so local practice is not limited to
one accent. Each file is mono 22.05 kHz PCM, contains non-zero audio packets, and
is mapped to the exact server-only script in `adaptive-practice.ts`.

The alternate upper-level fixtures added for the second reviewed task use:

| Problem ID | Voice | Rate | Duration |
| --- | --- | --- | --- |
| `listening-main_idea-practice-2` | Moira (`en_IE`) | 165 wpm | 9.80 s |
| `listening-main_idea-challenge-2` | Rishi (`en_IN`) | 160 wpm | 24.15 s |
| `listening-detail-practice-2` | Tessa (`en_ZA`) | 165 wpm | 12.07 s |
| `listening-detail-challenge-2` | Karen (`en_AU`) | 160 wpm | 18.68 s |

They were generated with the same system-voice pipeline as the other reviewed
fixtures:

```sh
say -v <voice> -r <rate> -o /tmp/<problem-id>.aiff '<exact server-only script>'
afconvert -f WAVE -d LEI16@22050 /tmp/<problem-id>.aiff static/practice-audio/<problem-id>.wav
```

Do not expose the script in the learner payload. The authenticated practice audio
route serves a matching fixture or generated speech, records successful delivery,
and only then allows the response to count as listening evidence.
