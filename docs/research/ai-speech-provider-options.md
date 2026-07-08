# AI and speech provider options for ESL MVP

Date: 2026-07-08

## Question

Which current AI, speech-to-text, text-to-speech, and pronunciation/voice providers are the best fit for this ESL assessment MVP on a Cloudflare/SvelteKit stack?

## Answer

Use Cloudflare Workers AI first, with Cloudflare AI Gateway only where its controls are worth the logging/privacy overhead. The first MVP stack should be:

1. OpenAI API for writing scoring, speaking rubric scoring from transcripts, adaptive practice generation, and structured JSON outputs.
2. Cloudflare Workers AI for Cloudflare-native audio plumbing: Whisper or Deepgram Nova-3 for learner STT, and Deepgram Aura for simple listening-item TTS.
3. Defer realtime voice bots, premium TTS, and true pronunciation scoring until #34 decides the ESL Assessment must include speaking beyond transcript-backed Error Signals.

Deepgram is the best upgrade path for learner STT and realtime voice if Cloudflare's hosted Deepgram models are not enough. ElevenLabs and Cartesia are better TTS/voice specialists than first-stack requirements. AssemblyAI is a strong STT alternative, but adds another provider without solving pronunciation scoring. Speechace is the most directly relevant pronunciation-scoring candidate, but it should remain deferred unless the product needs word/phoneme-level pronunciation feedback.

## Comparison

| Provider                           | Best MVP fit                                | Covers                                                                                             | Cloudflare fit                                              | Recommendation                                         |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Cloudflare Workers AI + AI Gateway | Native STT/TTS, gateway controls            | Learner STT, listening TTS, batch audio, realtime voice plumbing                                   | Excellent: `AI` binding, REST, WebSocket, AI Gateway        | Use Workers AI directly first; use Gateway selectively |
| OpenAI API                         | Skill Diagnosis reasoning and generation    | Writing/speaking scoring from text, adaptive practice, structured JSON, TTS/STT/realtime if needed | Good via server-side fetch or AI Gateway REST               | Use for scoring/generation                             |
| Deepgram                           | Higher-grade learner STT and realtime voice | Learner STT, batch/streaming audio, word timings, voice-agent STT, TTS via Aura                    | Good direct API; several Deepgram models also on Workers AI | Upgrade path for speech                                |
| ElevenLabs                         | Premium voices and optional STT             | Listening TTS, STT, realtime STT, voice agents, forced alignment                                   | Good direct HTTP/WebSocket or AI Gateway WebSocket          | Defer unless voice quality matters                     |
| Cartesia                           | Low-latency TTS and voice-agent STT         | Listening TTS, realtime TTS, STT, voice agents, pronunciation dictionaries                         | Good direct HTTP/WebSocket or AI Gateway WebSocket          | Defer unless voice control matters                     |
| AssemblyAI                         | STT alternative                             | Learner STT, batch/streaming, language detection, PII redaction, speech understanding              | Good direct HTTP/WebSocket                                  | Defer; overlap with Deepgram                           |
| Speechace                          | Pronunciation scoring                       | Pronunciation judgment, fluency scoring, phoneme/word feedback                                     | HTTP API should fit Workers                                 | Defer unless pronunciation is in scope                 |

## Provider notes

### Cloudflare Workers AI and AI Gateway

MVP coverage:

- Workers AI covers learner STT with `@cf/openai/whisper`, `@cf/openai/whisper-large-v3-turbo`, `@cf/deepgram/nova-3`, and realtime `@cf/deepgram/flux`; listening-item TTS with `@cf/deepgram/aura-1` / Aura-2; batch audio where model docs mark batch support; realtime voice through Cloudflare's `@cloudflare/voice` beta and AI Gateway WebSockets.[^cf-whisper][^cf-pricing][^cf-voice][^cf-realtime]
- It does not replace a strong text model for writing scoring, adaptive practice, or schema-heavy assessment output. Use OpenAI for those parts unless the implementation ticket chooses a Cloudflare-hosted LLM.

Credentials and deployment:

- Direct Workers AI uses the `AI` binding in `wrangler` config. REST requires `CLOUDFLARE_ACCOUNT_ID` and a Cloudflare API token.[^cf-whisper]
- AI Gateway REST uses a Cloudflare API token with `AI Gateway` permission; it can call Workers AI and third-party models through `/ai/run`, OpenAI-compatible `/ai/v1/chat/completions`, and `/ai/v1/responses` endpoints.[^cf-aig-rest]

Privacy, latency, cost, limits:

- Workers AI docs say Cloudflare does not train or improve services on Customer Content without explicit consent, and content is stored only when paired with a storage product such as R2, KV, Durable Objects, or Vectorize.[^cf-data]
- AI Gateway logs request and response payloads by default. For learner audio or assessment text, set gateway logging off or send `cf-aig-collect-log: false`; use `cf-aig-collect-log-payload: false` if metadata is useful but payload storage is not.[^cf-aig-logging]
- Current public Workers AI audio pricing includes Whisper around $0.0005/audio minute, Deepgram Nova-3 $0.0052/audio minute HTTP or $0.0092/audio minute WebSocket, Flux WebSocket $0.0077/audio minute, Aura-1 $0.015/1k characters, and Aura-2 $0.030/1k characters.[^cf-pricing]
- Workers AI ASR default limit is 720 requests/minute. AI Gateway has separate gateway/log limits, including 200 Unified Billing requests per 60 seconds per gateway when using Cloudflare-managed credentials.[^cf-workers-limits][^cf-aig-limits]

Chinese-L1 ESL fit:

- Whisper is multilingual and can do recognition, translation, and language ID.[^cf-whisper]
- Deepgram Nova-3/Flux through Workers AI is stronger for realtime learner speech than basic Whisper where word timing and turn-taking matter.
- No Cloudflare model is a full pronunciation rubric. Treat STT output as evidence for speaking Error Signals, not as final pronunciation judgment.

Integration shape:

- Start with direct `env.AI.run(...)` from SvelteKit server code running on Workers.
- Add AI Gateway later for provider fallback, analytics, caching, or central rate limiting. Do not turn on payload logs for learner audio.

### OpenAI API

MVP coverage:

- Best fit for writing scoring, speaking scoring from transcript text, adaptive practice generation, structured Skill Profile JSON, and tool/schema calling.
- Audio APIs can also cover STT (`gpt-4o-transcribe`, `gpt-4o-mini-transcribe`), TTS (`gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`), and realtime voice, but those duplicate Workers AI/Deepgram for the first stack.[^openai-stt][^openai-tts][^openai-realtime]

Credentials and deployment:

- Use one server-side secret: `OPENAI_API_KEY`.
- Integration is direct `fetch` or the OpenAI SDK from server-only code. AI Gateway REST can also proxy OpenAI-compatible requests with a Cloudflare token if #34 wants one control plane.[^cf-aig-rest]

Privacy, latency, cost, limits:

- OpenAI states API data is not used to train models unless the customer opts in. Its data table lists `/v1/audio/transcriptions` with no abuse-monitoring retention and no application-state retention; `/v1/audio/speech`, `/v1/responses`, and `/v1/realtime` have 30-day abuse-monitoring retention by default and may be eligible for Zero Data Retention depending on endpoint/control approval.[^openai-data]
- Pricing docs list `gpt-4o-transcribe` at an estimated $0.006/minute and `gpt-4o-mini-transcribe` at $0.003/minute; realtime/audio generation prices are token-based.[^openai-pricing]
- Rate limits are organization/project/model-specific and exposed in response headers; usage tiers raise limits with spend.[^openai-rate-limits]

Chinese-L1 ESL fit:

- Strong structured output support is useful for target-level Error Signals and rubric outputs. OpenAI recommends Structured Outputs over JSON mode when schema adherence matters.[^openai-structured]
- TTS supports prompting for accent, intonation, speed, tone, and related speech controls, but voices are currently optimized for English.[^openai-tts]
- It is not a dedicated pronunciation scoring API. Use it to reason over transcripts and rubrics, not to infer phoneme accuracy from raw audio.

Integration shape:

- Direct server-side HTTP/SDK. Keep prompts and learner artifacts server-side; store only the Skill Diagnosis data needed in D1.

### Deepgram

MVP coverage:

- Best speech upgrade path: learner STT, batch audio processing, realtime transcription, voice-agent STT, word-level timing, turn detection, language detection, keyterm prompting, and optional TTS via Aura.
- It does not cover writing scoring or adaptive practice generation without a separate LLM.

Credentials and deployment:

- Direct Deepgram uses `DEEPGRAM_API_KEY` in an `Authorization: Token ...` header.[^deepgram-auth]
- Cloudflare can also run Deepgram models through Workers AI (`@cf/deepgram/nova-3`, `@cf/deepgram/flux`, Aura) without a Deepgram key, or route direct Deepgram through AI Gateway if central logging/rate limits are needed.[^cf-pricing][^cf-realtime]

Privacy, latency, cost, limits:

- Deepgram documents a model-improvement partnership program and says data used for training is contractually included through that program; customers can opt out. Regional endpoints are available for EU/AU routing.[^deepgram-mip][^deepgram-regional]
- Public rate-limit docs list Pay-as-you-go concurrency at 50 pre-recorded / 150 streaming requests for Nova-class STT, 150 streaming for Flux, 15 TTS REST, and 45 TTS streaming.[^deepgram-limits]
- Cloudflare Workers AI pricing currently exposes Deepgram Nova-3, Flux, Aura-1, and Aura-2 rates directly.[^cf-pricing]

Chinese-L1 ESL fit:

- Deepgram docs call out global English accent handling, multilingual models, language detection, word timings, interim results, endpointing, utterance-end, and noise/non-speech handling. Those are useful for Chinese-L1 learner speech where accent, pauses, final consonants, and noisy capture are expected.[^deepgram-lang][^deepgram-models][^deepgram-utterance]
- Still not a pronunciation-scoring engine. It can support timing/confidence Error Signals, but phoneme judgment should be a separate ticket.

Integration shape:

- Use Workers AI model IDs first for simplest Cloudflare deploy.
- If direct Deepgram is chosen later, use HTTP for pre-recorded assessment clips and WebSocket for realtime speaking flows.

### ElevenLabs

MVP coverage:

- Strong for listening-item TTS, premium voices, realtime TTS, optional STT with Scribe v2, realtime STT, forced alignment, and ElevenAgents.
- Not needed for first writing/scoring/adaptive practice.

Credentials and deployment:

- Use `ELEVENLABS_API_KEY` server-side. Realtime/browser flows should use provider-supported temporary or single-use token patterns where available rather than exposing the API key.
- Direct HTTP/WebSocket works from a Worker; AI Gateway also supports ElevenLabs WebSocket proxying.[^cf-realtime]

Privacy, latency, cost, limits:

- Enterprise Zero Retention Mode can be enabled for eligible API products by sending `enable_logging=false`; covered items include TTS/STT text and audio input/output. Default retention is enabled if ZRM is not active.[^eleven-zrm]
- API pricing lists TTS at $0.05/1k characters for Flash/Turbo and $0.10/1k characters for Multilingual/v3; STT at $0.22/hour for Scribe and $0.39/hour realtime. Flash TTS is documented around 75ms model inference, while Scribe v2 realtime lists around 150ms low latency.[^eleven-pricing][^eleven-models][^eleven-stt]

Chinese-L1 ESL fit:

- TTS has high-quality English voices, multilingual support, and pronunciation dictionaries; good for controlled listening items.[^eleven-tts][^eleven-models]
- Scribe v2 supports 90+ languages, word-level timestamps, diarization, audio tagging, language detection, keyterms, and entity detection.[^eleven-stt]
- It is not the best first pronunciation-scoring answer; forced alignment can help compare expected text and spoken timing, but it is not a learner pronunciation rubric.

Integration shape:

- Direct REST/WebSocket fetch from server routes. Use only if #34 prioritizes voice quality over provider minimalism.

### Cartesia

MVP coverage:

- Strong for low-latency, controllable TTS; viable for realtime STT and voice agents; pronunciation dictionaries and IPA-style custom pronunciations are useful for listening-item authoring.
- Not a writing/adaptive-generation provider.

Credentials and deployment:

- Use `CARTESIA_API_KEY` server-side, `Cartesia-Version: 2026-03-01`, and short-lived access tokens for browser TTS/STT WebSockets. Access tokens can grant `tts`, `stt`, or `agent` separately.[^cartesia-auth]
- Direct HTTP/WebSocket works on Workers; AI Gateway supports Cartesia WebSocket routing.[^cf-realtime]

Privacy, latency, cost, limits:

- Enterprise ZDR covers TTS/STT text/audio inputs and outputs; operational metadata is retained. ZDR does not cover voice cloning or workflows needing retained source material.[^cartesia-zdr]
- Sonic 3.5 docs list sub-90ms first-byte TTS latency and native support for 42 languages.[^cartesia-sonic]
- Pricing uses credits: standard TTS is about 1 credit/character; realtime Ink-2 STT is 3 credits/second; batch `ink-whisper` is 1 credit per 2 seconds. Concurrency starts at Free 2 TTS / 8 STT, Pro 3 / 12, Startup 5 / 20, Scale 15 / 60.[^cartesia-pricing][^cartesia-limits]

Chinese-L1 ESL fit:

- Sonic supports Chinese and many other languages, accent/pronunciation control, heteronym handling, and custom pronunciations; this is useful for bilingual explanations and precise listening-item TTS.[^cartesia-sonic][^cartesia-pronunciation]
- Ink 2's current stable doc is English-only. Do not choose it as the first multilingual learner-STT path without a targeted spike.[^cartesia-ink]

Integration shape:

- Direct HTTP/WebSocket. Defer unless premium TTS or exact pronunciation control becomes an MVP requirement.

### AssemblyAI

MVP coverage:

- Strong alternative for learner STT, batch/streaming transcription, language detection, PII redaction, speech understanding, LLM Gateway workflows, and voice-agent STT.
- Does not directly solve TTS. It is not a dedicated pronunciation-scoring API.

Credentials and deployment:

- Use `ASSEMBLYAI_API_KEY` server-side. Streaming can use temporary tokens.[^assembly-index]
- Direct HTTP/WebSocket from Workers should fit; no special Cloudflare binding.

Privacy, latency, cost, limits:

- AssemblyAI docs describe model-training opt-out, EU server exclusions, BAA behavior, encryption, streaming zero data retention for opted-out customers, and configurable TTL for async artifacts down to one hour.[^assembly-data]
- Rate limits and pricing are product/page-specific; this is a reason to defer until a concrete implementation ticket needs it.

Chinese-L1 ESL fit:

- Good STT feature set: supported languages, automatic language detection, streaming, keyterms, Voice Focus/noise reduction, PII redaction, diarization, and speech understanding are documented areas.[^assembly-index]
- For this repo, Deepgram overlaps with less provider surface area because Deepgram is already available through Cloudflare Workers AI.

Integration shape:

- Direct HTTP/WebSocket only if #34 rejects Deepgram or specifically needs AssemblyAI speech-understanding features.

### Speechace

MVP coverage:

- Best candidate in this research set for actual pronunciation judgment: word/sentence pronunciation, phoneme and syllable feedback, fluency, IELTS/CEFR/PTE/TOEIC-style speaking scores, grammar/coherence for open-ended speaking, and language-learning-specific scoring.[^speechace-docs][^speechace-pricing]

Credentials and deployment:

- Use a server-side Speechace API key. HTTP requests should fit Workers, but a short proof should verify payload size, audio format, timeout, and pricing before implementation.

Privacy, latency, cost, limits:

- Public pricing starts around $40/month for word/sentence pronunciation activities with included 15-second requests, then higher tiers for fluency and open-ended activities. This is subscription-like, not the same usage model as STT/TTS providers.[^speechace-pricing]
- Data retention controls were not as clearly documented in the primary pages reviewed as Cloudflare/OpenAI/Cartesia/ElevenLabs/AssemblyAI. That is a blocker for using it with learner audio before a privacy review.

Chinese-L1 ESL fit:

- Strongest pedagogical fit for final consonants, clusters, stress, rhythm, and phoneme-level feedback if pronunciation becomes a scored part of the ESL Assessment.
- Supports English US/UK among other languages, which is enough for this learner's English pronunciation practice.

Integration shape:

- Defer as a separate pronunciation spike after #34. Do not mix this into the first MVP provider contract.

## Recommended first MVP provider stack

Use the smallest useful stack:

1. `OPENAI_API_KEY` for text scoring, Skill Profile generation, adaptive practice, and strict JSON output.
2. Cloudflare `AI` binding for STT/TTS experiments inside Workers:
   - Start with `@cf/openai/whisper` or `@cf/openai/whisper-large-v3-turbo` for simple learner STT.
   - Prefer `@cf/deepgram/nova-3` if word-level timing and stronger speech quality are needed.
   - Use `@cf/deepgram/aura-1` or Aura-2 for basic listening-item TTS.
3. Keep AI Gateway optional. If used, disable payload logging for learner audio and assessment prompts.

This covers the first diagnostic grammar/writing MVP and a lightweight speaking/listening path without adding direct Deepgram, ElevenLabs, Cartesia, AssemblyAI, and Speechace credentials all at once.

## Minimal env/credential contract

Required first:

- `OPENAI_API_KEY`
- Cloudflare Workers `AI` binding

Optional only if #34 chooses the specific path:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_ID`
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `CARTESIA_API_KEY`
- `ASSEMBLYAI_API_KEY`
- `SPEECHACE_API_KEY`

Do not store learner audio by default. Store transcripts, Error Signals, rubric outputs, and minimal metadata in D1 only after the assessment flow decides what is needed.

## What should remain deferred

- Realtime voice bot: defer until the MVP needs conversational practice instead of an assessment flow.
- Premium listening voices: defer ElevenLabs/Cartesia unless default Workers AI TTS quality blocks comprehension.
- Pronunciation scoring: defer Speechace or any phoneme-level scorer until the product explicitly needs pronunciation as a scored Skill Diagnosis area.
- Direct Deepgram account: defer unless Workers AI Deepgram models lack a required parameter, timestamp shape, latency, or model version.
- AI Gateway as mandatory path: defer until multiple providers need shared analytics, fallback, or rate limiting.

## Follow-up implementation tickets after #34 decides

1. Add OpenAI-backed writing Skill Diagnosis with strict JSON output and rubric versioning.
2. Add Cloudflare Workers AI STT spike comparing Whisper, Whisper large v3 turbo, and Deepgram Nova-3 on short learner samples.
3. Add listening-item TTS spike using Workers AI Aura and a generated-audio cache policy.
4. Add provider privacy guardrails: no learner-audio persistence by default, AI Gateway payload logging disabled, and deletion behavior documented.
5. If speaking remains in scope, create a pronunciation-scoring spike comparing Speechace against STT-derived lightweight Error Signals.
6. If realtime practice remains in scope, create a Cloudflare voice-agent prototype using Durable Objects and Workers AI Flux/Aura.

## Sources

[^cf-whisper]: Cloudflare Workers AI, [whisper model docs](https://developers.cloudflare.com/workers-ai/models/whisper/).

[^cf-pricing]: Cloudflare Workers AI, [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

[^cf-workers-limits]: Cloudflare Workers AI, [Limits](https://developers.cloudflare.com/workers-ai/platform/limits/).

[^cf-data]: Cloudflare Workers AI, [Data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

[^cf-aig-rest]: Cloudflare AI Gateway, [REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/).

[^cf-aig-logging]: Cloudflare AI Gateway, [Logging](https://developers.cloudflare.com/ai-gateway/observability/logging/).

[^cf-aig-limits]: Cloudflare AI Gateway, [Limits](https://developers.cloudflare.com/ai-gateway/reference/limits/).

[^cf-voice]: Cloudflare Agents, [Voice](https://developers.cloudflare.com/agents/communication-channels/voice/).

[^cf-realtime]: Cloudflare AI Gateway, [Realtime WebSockets API](https://developers.cloudflare.com/ai-gateway/usage/websockets-api/realtime-api/).

[^openai-stt]: OpenAI API docs, [Speech to text](https://platform.openai.com/docs/guides/speech-to-text).

[^openai-tts]: OpenAI API docs, [Text to speech](https://platform.openai.com/docs/guides/text-to-speech).

[^openai-realtime]: OpenAI API docs, [Realtime and audio](https://platform.openai.com/docs/guides/realtime).

[^openai-data]: OpenAI API docs, [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data).

[^openai-pricing]: OpenAI API docs, [Pricing](https://platform.openai.com/docs/pricing).

[^openai-rate-limits]: OpenAI API docs, [Rate limits](https://developers.openai.com/api/docs/guides/rate-limits).

[^openai-structured]: OpenAI API docs, [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

[^deepgram-auth]: Deepgram docs, [Authentication](https://developers.deepgram.com/reference/authentication).

[^deepgram-models]: Deepgram docs, [Models & Languages Overview](https://developers.deepgram.com/docs/models-languages-overview).

[^deepgram-lang]: Deepgram docs, [Languages Support](https://developers.deepgram.com/docs/language).

[^deepgram-utterance]: Deepgram docs, [End of Speech Detection While Live Streaming](https://developers.deepgram.com/docs/understanding-end-of-speech-detection).

[^deepgram-limits]: Deepgram docs, [API Rate Limits](https://developers.deepgram.com/reference/api-rate-limits).

[^deepgram-mip]: Deepgram docs, [Model Improvement Partnership Program](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program).

[^deepgram-regional]: Deepgram docs, [Custom endpoints / regional endpoints](https://developers.deepgram.com/reference/custom-endpoints).

[^eleven-tts]: ElevenLabs docs, [Text to Speech](https://elevenlabs.io/docs/overview/capabilities/text-to-speech).

[^eleven-stt]: ElevenLabs docs, [Transcription](https://elevenlabs.io/docs/overview/capabilities/speech-to-text).

[^eleven-models]: ElevenLabs docs, [Models](https://elevenlabs.io/docs/overview/models).

[^eleven-pricing]: ElevenLabs, [API pricing](https://elevenlabs.io/pricing/api).

[^eleven-zrm]: ElevenLabs docs, [Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode).

[^cartesia-auth]: Cartesia docs, [Authenticate your applications](https://docs.cartesia.ai/get-started/authenticate-your-client-applications).

[^cartesia-zdr]: Cartesia docs, [Zero Data Retention](https://docs.cartesia.ai/enterprise/zero-data-retention).

[^cartesia-sonic]: Cartesia docs, [Sonic 3.5](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest).

[^cartesia-ink]: Cartesia docs, [Ink 2](https://docs.cartesia.ai/build-with-cartesia/stt/latest).

[^cartesia-pronunciation]: Cartesia docs, [Specify Custom Pronunciations](https://docs.cartesia.ai/build-with-cartesia/capability-guides/specify-custom-pronunciations).

[^cartesia-pricing]: Cartesia docs, [Pricing](https://docs.cartesia.ai/pricing).

[^cartesia-limits]: Cartesia docs, [Concurrency and WebSocket Limits](https://docs.cartesia.ai/use-the-api/concurrency-limits-and-timeouts).

[^assembly-index]: AssemblyAI docs, [Documentation index](https://www.assemblyai.com/docs/llms.txt).

[^assembly-data]: AssemblyAI docs, [Data retention and model training](https://www.assemblyai.com/docs/data-retention-and-model-training).

[^speechace-docs]: Speechace, [API documentation](https://docs.speechace.com/).

[^speechace-pricing]: Speechace, [API plans](https://www.speechace.com/api-plans/).
