# Pronunciation scoring provider options

Date: 2026-07-08

## Question

What mainstream alternatives to Speechace can score ESL speaking pronunciation, not just transcribe audio?

## Answer

If pronunciation scoring is required in the MVP, the mainstream choice is Microsoft Azure Speech Pronunciation Assessment. It is the only major cloud speech product found in this pass that explicitly offers pronunciation assessment with accuracy, fluency, completeness, prosody, and word/phoneme-level feedback.

Speechace is still a strong language-learning-specific option. SpeechSuper is the closest specialist alternative. Pearson Versant and ETS SpeechRater are credible assessment engines, but they look more like enterprise/test-product partnerships than simple API building blocks for this app. Google Cloud Speech-to-Text, Amazon Transcribe, Deepgram, AssemblyAI, and OpenAI audio are transcription or speech-generation options, not dedicated pronunciation-scoring providers.

## Practical recommendation

For a one-provider AI/speech contract, choose Azure/Microsoft:

- Azure OpenAI for scoring, adaptive generation, and structured JSON Skill Profile output.
- Azure Speech Pronunciation Assessment for speaking pronunciation, fluency, completeness, and prosody.
- Azure Speech STT/TTS only if needed for the same-provider constraint.

For a smaller implementation contract, choose OpenAI plus Azure Speech Pronunciation Assessment:

- OpenAI remains simpler for text scoring and adaptive generation.
- Azure handles only pronunciation assessment.

Do not choose Cloudflare-only or OpenAI-only if real pronunciation scoring is in MVP; neither provides a dedicated pronunciation assessment rubric.

## Comparison

| Provider                              | Mainstream fit                      | Pronunciation scoring fit                                                                       | MVP concern                                                                    |
| ------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Azure Speech Pronunciation Assessment | High: major cloud provider          | High: purpose-built pronunciation assessment, including word/phoneme-level feedback and prosody | Adds Azure account/region/key; REST details need a spike on Cloudflare Workers |
| Speechace                             | Medium: specialist education API    | High: purpose-built pronunciation, fluency, IELTS/CEFR/PTE/TOEIC-style speaking scores          | Less mainstream; audio retention/privacy choices need review                   |
| SpeechSuper                           | Medium: specialist education API    | High: scripted/open speech, phoneme/word scoring, fluency, grammar/vocabulary/topic features    | Less mainstream; vendor/privacy review needed                                  |
| Pearson Versant                       | High: established assessment vendor | Medium-high: validated speaking tests report pronunciation/fluency                              | Not clearly a drop-in API for custom in-app exercises                          |
| ETS SpeechRater                       | High: established test vendor       | Medium-high: TOEFL-aligned spoken-response scoring                                              | Licensing/integration likely heavier than MVP API use                          |
| Google Cloud Speech-to-Text           | High: major cloud provider          | Low: STT, adaptation, accuracy tooling                                                          | No first-party pronunciation assessment found                                  |
| Amazon Transcribe                     | High: major cloud provider          | Low: STT, vocab/model customization                                                             | No first-party pronunciation assessment found                                  |

## Notes

Azure Speech Pronunciation Assessment:

- Microsoft documents pronunciation assessment as part of Speech service, using a specific speech-to-text model for consistent pronunciation assessment.
- It supports scores such as accuracy, fluency, completeness, pronunciation score, and prosody; Microsoft docs also describe phoneme-level feedback.
- REST short-audio docs expose a `Pronunciation-Assessment` header, so a Cloudflare Worker can likely call it by HTTP without using the full Speech SDK.
- Microsoft's responsible AI docs say customers should evaluate it in their own application because performance depends on real-world use, audio quality, background noise, and STT accuracy.

Azure-only as a provider contract:

- Azure OpenAI supports structured outputs with the same JSON Schema subset as OpenAI.
- Microsoft says data for Azure-sold Foundry models, including Azure OpenAI models, is not available to OpenAI or other providers and is not used to train foundation models without permission.
- This is the cleanest "one mainstream provider" route if the app must include pronunciation scoring.

Speechace:

- Speechace plans include word/sentence pronunciation, phoneme and syllable feedback, fluency, IELTS/CEFR/PTE/TOEIC-style scores, and open-ended speaking metrics.
- Speechace's API privacy policy recommends callers choose short retention targets such as 30 or 90 days for audio.
- It remains viable, but it is not as mainstream as Azure.

SpeechSuper:

- SpeechSuper advertises sentence, word, phoneme, mispronunciation, syllable stress, linking, fluency, grammar, vocabulary, and topic development feedback.
- Pricing is request-based and starts at small per-request rates with a monthly minimum.
- It is a reasonable specialist alternative to Speechace, not a mainstream cloud-provider answer.

Pearson Versant and ETS SpeechRater:

- Pearson Versant is a mature automated language-testing product with pronunciation and fluency subscores.
- ETS SpeechRater is TOEFL-aligned and evaluates markers including pronunciation, fluency, vocabulary, and grammar.
- Both are credible if the goal becomes test-aligned benchmarking, but they are probably too heavy for the first embedded MVP unless a partnership/API route is confirmed.

Google and AWS:

- Google Cloud Speech-to-Text and Amazon Transcribe are mainstream speech-to-text products.
- Their public docs in this pass focus on transcription, adaptation, custom vocabulary/model features, and data handling, not pronunciation assessment.

## Sources

- Microsoft Learn, [Use pronunciation assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment).
- Microsoft Learn, [Speech to text REST API for short audio](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short).
- Microsoft Learn, [Pronunciation assessment tool](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/pronunciation-assessment-tool).
- Microsoft Learn, [Characteristics and limitations of Pronunciation Assessment](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/pronunciation-assessment/characteristics-and-limitations-pronunciation-assessment).
- Microsoft Learn, [Language and voice support for Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support).
- Microsoft Learn, [Data, privacy, and security for Speech to text](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security).
- Microsoft Learn, [Structured outputs with Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs).
- Microsoft Learn, [Data, privacy, and security for Foundry Models sold by Azure](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy).
- Speechace, [API plans](https://www.speechace.com/api-plans/).
- Speechace, [API privacy policy](https://www.speechace.com/api-privacy-policy/).
- Speechace API docs, [Use cases](https://api-docs.speechace.com/introduction/use-cases).
- SpeechSuper, [Pronunciation Assessment and Scoring API Solutions](https://www.speechsuper.com/).
- SpeechSuper, [Pricing plans](https://www.speechsuper.com/pricing.html).
- Pearson, [Versant by Pearson tests](https://www.pearson.com/languages/hr-professionals/versant/our-tests.html).
- Pearson support, [Automated scoring for speaking tests](https://support.pearson.com/languages/s/article/Versant-Automated-scoring-for-speaking-tests).
- ETS, [SpeechRater service](https://www.ets.org/speechrater.html).
- Google Cloud, [Cloud Speech-to-Text documentation](https://docs.cloud.google.com/speech-to-text/docs).
- Google Cloud, [Data usage FAQ](https://docs.cloud.google.com/speech-to-text/docs/v1/data-usage-faq).
- AWS, [Amazon Transcribe AI Service Card](https://docs.aws.amazon.com/ai/responsible-ai/transcribe-speech-recognition/overview.html).
- AWS, [Improving transcription accuracy](https://docs.aws.amazon.com/transcribe/latest/dg/improving-accuracy.html).
