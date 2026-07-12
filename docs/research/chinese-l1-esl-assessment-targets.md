# Chinese L1 ESL assessment targets

Date: 2026-07-08

> **Scope update (2026-07-11):** The product is now an exam-aligned placement
> study tool. The earlier recommendation to defer broader reading and listening
> strategies no longer applies when the selected Placement Test Profile includes
> those sections. See [placement-test-profiles.md](placement-test-profiles.md).

## Question

What English-learning error patterns, transfer effects, and assessment targets matter most for Chinese L1 learners, and which are practical to assess in a first MVP?

## Answer

For a first diagnostic MVP, assess a small set of high-frequency, machine-checkable grammar and lexis targets before attempting broad four-skill proficiency scoring. The best first targets are:

1. Article and determiner use: a/an/the, zero article, this/that, one/ones.
2. Verb morphology and finiteness: tense, third-person singular -s, auxiliary/copula use, gerund/infinitive choice, finite vs nonfinite forms.
3. Noun morphology and countability: plural -s, count/noncount choices, quantifiers.
4. Prepositions and fixed verb/noun/adjective patterns.
5. Word choice and collocation, especially high-frequency academic/general verbs and Chinese-English literal expression.
6. Sentence structure basics: subject-verb agreement, missing subjects, run-ons, question/embedded-question word order.
7. Third-person pronoun gender: he/she/his/her in short contexts.

Defer pronunciation scoring for the MVP. Speaking feedback can use Workers AI transcription plus transcript-level surface analysis for grammar errors, vocabulary misuse, clarity, task completion, fluency indicators, and related observable issues. The most relevant Chinese L1 pronunciation targets are final consonants, consonant clusters, final /l/, dental fricatives, /v/, stress, rhythm, and intonation, but reliable scoring needs dedicated speech evaluation beyond the MVP.

## Why these targets

Chinese and English differ sharply in articles, inflection, tense/aspect marking, countability, and syllable structure. Those differences match the error clusters reported in learner-corpus and applied-linguistics sources:

- Learner corpora are appropriate evidence for this MVP because they expose repeated learner output patterns. ICNALE includes controlled essays and speeches from learners in China, Hong Kong, and Taiwan, among other Asian regions, plus native-speaker comparison data.[^icnale] A newer Chinese Learner English Corpus was built specifically as an L1 Chinese counterpart corpus for contrastive interlanguage analysis.[^clec]
- The English Grammar Profile is a useful level reference for grammar targets because it maps English grammar competence to CEFR levels from learner-corpus evidence, rather than only intuition.[^egp]
- Corpus studies of Chinese EFL writing repeatedly identify tense/verb form errors as a top category, with spelling, word/phrase choice, Chinese-English expression, singular/plural noun form, parts of speech, nonfinite verbs, run-ons, and pronouns also recurring.[^zhan]
- A corpus study on Chinese EFL finite/nonfinite distinctions found transfer tied to Chinese's lack of morphological finiteness: lower-proficiency learners showed both bare-verb transfer and over-inflected nonfinite verbs; morphology remained difficult even as syntactic transfer dropped with proficiency.[^tang]
- Mandarin Chinese has no obligatory article system, which makes English article and determiner use a plausible diagnostic target even when advanced learners can perform well on constrained tasks.[^articles]
- A recent ICNALE-based inflectional-morpheme study highlights plural nouns, subject-verb agreement, past tense, past participles, present participles, possessives, comparatives, and superlatives as analyzable learner-morphology features.[^morphemes]
- A recent Oxford dissertation focused on Chinese adolescents found that 3rd-person singular agreement, simple past tense, and progressive aspect were not fully acquired after years of instruction; the lowest-accuracy feature was 3rd-person singular agreement, which does not exist in Chinese grammar.[^verbmorph]
- Chinese L1 learners can also show persistent he/she errors because spoken Chinese does not distinguish male and female third-person singular pronouns. This is small enough for a first MVP to test with short reading or picture-context items.[^pronouns]
- Pronunciation sources point to final consonants and clusters as high-value Chinese L1 targets because Mandarin syllable structure permits far fewer final consonant patterns than English.[^han] A perception study similarly notes that Mandarin Chinese speakers are expected to have difficulty perceiving English syllable-final consonants because consonants seldom occur syllable-finally in Mandarin.[^finals]

## MVP assessment shape

Use a two-part diagnostic:

1. Short selected-response grammar/usage section.
   - Minimal item types: cloze, sentence correction, and choose-the-best-rewrite.
   - Target: articles, tense/aspect, agreement, plurals/countability, prepositions, and finite/nonfinite verb forms.
   - Output: per-target strengths/needs, not just one score.

2. Short constrained writing sample.
   - Prompt: 120-180 words on a familiar topic.
   - Score with a small rubric: grammar accuracy, vocabulary/collocation, sentence control, and overall comprehensibility.
   - Extract target tags from observed errors and map them to recommendations.

Use CEFR as a light organizing scale, not as a claim of full CEFR certification. The Council of Europe's CEFR Companion Volume is the official descriptor source, while TOEFL's public test structure is a useful reminder that full proficiency testing usually covers reading, listening, writing, and speaking separately.[^cefr][^toefl] This MVP is diagnostic study guidance, so it can honestly report "grammar/usage diagnostic" and "writing sample indicators" before broader skill scores exist.

## Practical target table

| Target                                  | Chinese L1 relevance                                                             | MVP practicality  | Recommendation                                       |
| --------------------------------------- | -------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------- |
| Articles/determiners                    | Strong structural gap; no obligatory article system in Mandarin                  | High              | Include from v1                                      |
| Verb tense/aspect/morphology            | Repeated corpus finding; Chinese lacks English-style finiteness inflection       | High              | Include from v1                                      |
| Plural/countability                     | Inflectional morphology and count/noncount distinctions recur in writing errors  | High              | Include from v1                                      |
| Prepositions                            | Frequent in writing-error studies; good cloze coverage                           | High              | Include from v1                                      |
| Subject-verb agreement                  | Repeated inflectional target; machine-checkable                                  | High              | Include from v1                                      |
| Gerunds/infinitives/nonfinite clauses   | Chinese-English finiteness mismatch; common in advanced writing                  | Medium            | Include a few items, avoid over-weighting            |
| Collocation/word choice                 | Useful for study guidance; harder to score deterministically                     | Medium            | Include in writing rubric and recommendation tags    |
| He/she pronoun gender                   | Spoken Chinese uses the same pronunciation for male/female third-person pronouns | High              | Include a few short-context items                    |
| Pronunciation final consonants/clusters | High L1 relevance                                                                | Medium-low        | Optional self-study screen; defer score              |
| Listening/reading strategies            | Important for overall ESL proficiency, less Chinese-L1-specific                  | Medium-low        | Defer unless destination becomes placement/exam prep |
| Speaking fluency/pragmatics             | Important but expensive to score well                                            | Low for first MVP | Defer                                                |

## Original MVP decision

The first MVP should focus on a diagnostic grammar/usage test plus a short writing sample. It should produce target-level study recommendations for articles/determiners, verb morphology/finiteness, plural/countability, prepositions, agreement, he/she pronoun choice, sentence control, and collocation. Pronunciation, listening, reading, speaking fluency, and full CEFR/TOEFL-style scoring should stay out of the first build unless a later ticket changes the product scope.

The 2026-07-11 placement-preparation goal is that later scope change. Reading,
listening, and exam-specific task formats are now required when they appear in
the selected Placement Test Profile. The caution against uncalibrated CEFR or
official score claims still stands.

## Sources

[^icnale]: Shin'ichiro Ishikawa, Kobe University, [The ICNALE: International Corpus Network of Asian Learners of English](https://language.sakura.ne.jp/icnale/).

[^clec]: Kaatari, Larsson, Wang, Eklund Heinonen, Eickhoff, Kim, and Sundqvist, [Introducing the Chinese Learner English Corpus (CLEC)](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/introducing-the-chinese-learner-english-corpus-clec/859CBA31798105430C424631799F6339), Studies in Second Language Acquisition, Cambridge University Press.

[^egp]: O'Keeffe and Mark, [The English Grammar Profile of learner competence: Methodology and key findings](https://mic.elsevierpure.com/en/publications/the-english-grammar-profile-of-learner-competence-methodology-and/), International Journal of Corpus Linguistics, 2017.

[^zhan]: Zhan, [Frequent Errors in Chinese EFL Learners' Topic-Based Writings](https://eric.ed.gov/?id=EJ1075251), English Language Teaching, 2015.

[^tang]: Tang, [Crosslinguistic Influence on Chinese EFL Learners' Acquisition of English Finite and Nonfinite Distinctions](https://eric.ed.gov/?id=EJ1282680), Cogent Education, 2020.

[^articles]: Lopez, An, and Marsden, [Mandarin Speakers' Acquisition of English Articles](https://eprints.ncl.ac.uk/283418), in Challenges Encountered by Chinese ESL Learners, Springer, 2022.

[^morphemes]: Dogar, Saleem, Aslam, and Khan, [Exploring global linguistic nuances: analyzing region-specific inflectional morpheme frequency in ICNALE](https://link.springer.com/article/10.1186/s40862-024-00291-z), Asian-Pacific Journal of Second and Foreign Language Education, 2024.

[^verbmorph]: Liao, [The Acquisition of English Verb Morphology by Chinese Adolescents and the Role of the Learners' First Language](https://ora.ox.ac.uk/objects/uuid%3Aebbf79af-f76a-467d-ae23-7b40298d42f5/files/rm326m390j), Oxford University Research Archive, 2024.

[^pronouns]: Dong, Wen, Zeng, and Ji, [Exploring the cause of English pronoun gender errors by Chinese learners of English](https://bcdlab.gdufs.edu.cn/Exploring_the_cause_of_English_pronoun_gender_errors_by_Chinese_learners_of_English.pdf), Journal of Psycholinguistic Research.

[^han]: Han, [Pronunciation Problems of Chinese Learners of English](https://eric.ed.gov/?id=EJ1152473), ORTESOL Journal, 2013.

[^finals]: Chen, Wang, and Xu, [Perception of English syllable-final consonants by Chinese Mandarin speakers](https://www.internationalphoneticassociation.org/icphs-proceedings/ICPhS2015/Papers/ICPHS0389.pdf), Proceedings of ICPhS 2015.

[^cefr]: Council of Europe, [CEFR Companion Volume and its language versions](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions), 2020.

[^toefl]: ETS, [TOEFL iBT Test Content and Structure](https://www.ets.org/toefl/test-takers/ibt/about/content.html).
