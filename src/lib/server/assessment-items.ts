import { assessmentFormBItems } from './assessment-form-b-items';

export type AssessmentArea =
	'listening' | 'reading' | 'grammar_usage' | 'vocabulary' | 'writing' | 'speaking';

export const assessmentDefinitionVersion = 6;

export const assessmentFormIds = ['A', 'B'] as const;
export type AssessmentFormId = (typeof assessmentFormIds)[number];

export const profiledAssessmentKinds = ['accuplacer_esl', 'cambridge_cept'] as const;
export type ProfiledAssessmentKind = (typeof profiledAssessmentKinds)[number];
export type AssessmentDifficulty = 'foundation' | 'intermediate' | 'challenge';
export type ObjectiveAnswerMode = 'choice' | 'short_text';

export type ErrorSignal =
	| 'main_idea'
	| 'detail'
	| 'inference'
	| 'vocabulary_in_context'
	| 'verb_form'
	| 'subject_verb_agreement'
	| 'article_determiner'
	| 'plural_countability'
	| 'preposition'
	| 'pronoun_choice'
	| 'sentence_control'
	| 'collocation'
	| 'task_completion'
	| 'clarity'
	| 'fluency';

type Choice = {
	readonly id: string;
	readonly text: string;
};

export type ReviewMetadata = {
	authoringSessionId: string;
	reviewSessionId: string;
	reviewedAt: string;
	reviewerModel: string;
	status: 'accepted';
	notes: string;
};

export type AssessmentItem = {
	readonly id: string;
	readonly version: number;
	readonly formId: AssessmentFormId;
	readonly area: AssessmentArea;
	readonly taskType: string;
	readonly difficulty?: AssessmentDifficulty;
	readonly profile?: 'shared' | ProfiledAssessmentKind;
	readonly profileSections?: Partial<Record<ProfiledAssessmentKind, string>>;
	readonly stimulusGroupId?: string;
	readonly stimulusOrder?: 1 | 2 | 3;
	readonly answerMode?: ObjectiveAnswerMode;
	readonly prompt: string;
	readonly primaryScoredSignal?: ErrorSignal;
	readonly errorSignalTags: readonly ErrorSignal[];
	readonly explanation: string;
	readonly answerKey?: readonly string[];
	readonly rubric?: readonly string[];
	readonly choices?: readonly Choice[];
	readonly responseSignals?: Readonly<Partial<Record<string, readonly ErrorSignal[]>>>;
	readonly serverOnlyAudioScript?: string;
	readonly serverOnlyAudioMetadata?: {
		provider: 'workers-ai';
		model: '@cf/deepgram/aura-2-en';
		schemaVersion: 1;
	};
	readonly learnerTask: {
		instructions: string;
		choices?: readonly Choice[];
	};
	readonly review: ReviewMetadata;
};

export type LearnerAssessmentItem = Pick<
	AssessmentItem,
	| 'id'
	| 'version'
	| 'formId'
	| 'area'
	| 'taskType'
	| 'prompt'
	| 'answerMode'
	| 'stimulusGroupId'
	| 'stimulusOrder'
	| 'learnerTask'
> & { audioUrl?: string };

const ceptFormAListeningStimulus =
	'Our survey began with a simple question: why did students who owned bicycles still travel to campus by bus? At first, we expected distance to be the main reason. Distance mattered, but the pattern was not consistent. Students living near protected bicycle routes rode much more often than students the same distance away who had to use busy roads. Free repair events increased interest for a few weeks, but they did not produce a lasting change. The strongest relationship was between regular cycling and access to a route separated from heavy traffic. The university is now studying where one additional protected route could help the greatest number of students.';

const ceptFormAReadingStimulus =
	'When residents first proposed a garden on the unused land beside the station, some officials expected little interest. Yet every available plot was requested within a week. The first season was not entirely successful: poor drainage damaged several crops, and volunteers disagreed about how shared tools should be stored. Instead of ending the project, the group raised the planting beds and introduced a simple booking system for equipment. The following year, harvests improved and a nearby school began using part of the garden for science lessons. The project has not solved every problem in the neighborhood, but it has turned neglected land into a place where residents regularly work together.';

const assessmentFormAItems = [
	{
		id: 'listen-mei-coworker-time',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'listening', cambridge_cept: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen to a short spoken message and choose the correct detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'The key detail is the meeting time, not the place or activity.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'At 8:15.' },
			{ id: 'b', text: 'At 8:50.' },
			{ id: 'c', text: 'At 9:30.' },
			{ id: 'd', text: 'At 8:05.' }
		],
		responseSignals: {
			a: ['detail'],
			c: ['detail'],
			d: ['detail']
		},
		serverOnlyAudioScript: 'I will meet my coworker at eight fifty near the station.',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'Listen to the audio. What time will Mei meet her coworker?',
			choices: [
				{ id: 'a', text: 'At 8:15.' },
				{ id: 'b', text: 'At 8:50.' },
				{ id: 'c', text: 'At 9:30.' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Beginner-safe daily-life context; answer is explicit and unambiguous.'
		}
	},
	{
		id: 'listen-ana-pharmacy-main-idea',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'listening', cambridge_cept: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen and choose the main idea.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation: 'Ana is explaining that she needs to collect medicine after work.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'Ana needs to pick up medicine.' },
			{ id: 'b', text: 'Ana is applying for a new job.' },
			{ id: 'c', text: 'Ana is cooking dinner at work.' },
			{ id: 'd', text: 'Ana needs to collect medicine before work.' }
		],
		responseSignals: {
			b: ['main_idea'],
			c: ['main_idea']
		},
		serverOnlyAudioScript:
			'The pharmacy closes at seven, so I need to pick up my medicine after work.',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'Listen to Ana. What is she mainly talking about?',
			choices: [
				{ id: 'a', text: 'Ana needs to pick up medicine.' },
				{ id: 'b', text: 'Ana is applying for a new job.' },
				{ id: 'c', text: 'Ana is cooking dinner at work.' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'The main idea is explicit and the distractors are unrelated but plausible activities.'
		}
	},
	{
		id: 'listen-bus-platform-detail',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'listening', cambridge_cept: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen to an announcement and choose the correct detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail'],
		explanation: 'The announcement directs passengers to platform six.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'Platform 2.' },
			{ id: 'b', text: 'Platform 4.' },
			{ id: 'c', text: 'Platform 6.' },
			{ id: 'd', text: 'Platform 8.' }
		],
		responseSignals: {
			a: ['detail'],
			b: ['detail']
		},
		serverOnlyAudioScript:
			'The number twenty-four bus to Green Street will leave from platform six.',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'Which platform will the bus leave from?',
			choices: [
				{ id: 'a', text: 'Platform 2.' },
				{ id: 'b', text: 'Platform 4.' },
				{ id: 'c', text: 'Platform 6.' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Tests one concrete listening detail with short, parallel answer choices.'
		}
	},
	{
		id: 'read-lina-return-jacket',
		version: 1,
		area: 'reading',
		taskType: 'short_passage_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'reading_skills', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'Lina bought a jacket online. It was too small, so she sent it back the next day.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'The passage says the jacket was too small, so that is why Lina returned it.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'It was too expensive.' },
			{ id: 'b', text: 'It was too small.' },
			{ id: 'c', text: 'It arrived late.' },
			{ id: 'd', text: 'It was the wrong color.' }
		],
		responseSignals: {
			a: ['detail'],
			c: ['detail']
		},
		learnerTask: {
			instructions: 'Why did Lina return the jacket?',
			choices: [
				{ id: 'a', text: 'It was too expensive.' },
				{ id: 'b', text: 'It was too small.' },
				{ id: 'c', text: 'It arrived late.' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Concrete passage with one supported answer and no culturally loaded content.'
		}
	},
	{
		id: 'read-omar-library-main-idea',
		version: 1,
		area: 'reading',
		taskType: 'short_passage_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'reading_skills', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'Omar went to the library on Sunday, but the door was locked. A sign said the library would open again on Monday morning.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation: 'The passage is mainly about Omar finding the library closed on Sunday.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'Omar lost a library book.' },
			{ id: 'b', text: 'The library was closed when Omar arrived.' },
			{ id: 'c', text: 'Omar works at the library on Monday.' },
			{ id: 'd', text: 'The library opened again on Sunday afternoon.' }
		],
		responseSignals: {
			a: ['main_idea'],
			c: ['main_idea']
		},
		learnerTask: {
			instructions: 'What is the passage mainly about?',
			choices: [
				{ id: 'a', text: 'Omar lost a library book.' },
				{ id: 'b', text: 'The library was closed when Omar arrived.' },
				{ id: 'c', text: 'Omar works at the library on Monday.' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'The short passage supports one clear main idea without requiring outside knowledge.'
		}
	},
	{
		id: 'read-workshop-available-vocabulary',
		version: 1,
		area: 'reading',
		taskType: 'vocabulary_in_passage',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'reading_skills', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'The Saturday workshop is full, but places are still available in the Tuesday workshop.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation: 'In this notice, "available" means that places are still open to join.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'open to join' },
			{ id: 'b', text: 'already finished' },
			{ id: 'c', text: 'more expensive' },
			{ id: 'd', text: 'free of charge' }
		],
		responseSignals: {
			b: ['vocabulary_in_context'],
			c: ['vocabulary_in_context']
		},
		learnerTask: {
			instructions: 'What does "available" mean in this passage?',
			choices: [
				{ id: 'a', text: 'open to join' },
				{ id: 'b', text: 'already finished' },
				{ id: 'c', text: 'more expensive' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Context contrasts full with available, making the intended meaning recoverable.'
		}
	},
	{
		id: 'grammar-simple-present-goes',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'language_use', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'She ____ to work every morning.',
		primaryScoredSignal: 'subject_verb_agreement',
		errorSignalTags: ['verb_form', 'subject_verb_agreement'],
		explanation: 'Use "goes" with "she" in the simple present tense.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'go' },
			{ id: 'b', text: 'goes' },
			{ id: 'c', text: 'going' },
			{ id: 'd', text: 'gone' }
		],
		responseSignals: {
			a: ['subject_verb_agreement'],
			c: ['verb_form']
		},
		learnerTask: {
			instructions: 'Choose the best word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'go' },
				{ id: 'b', text: 'goes' },
				{ id: 'c', text: 'going' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Targets a high-value Chinese L1 verb morphology signal without assuming an error.'
		}
	},
	{
		id: 'grammar-article-umbrella',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'language_use', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'It is raining, so please take ____ umbrella.',
		primaryScoredSignal: 'article_determiner',
		errorSignalTags: ['article_determiner'],
		explanation: 'Use "an" before the vowel sound at the start of "umbrella."',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'a' },
			{ id: 'b', text: 'an' },
			{ id: 'c', text: 'some' },
			{ id: 'd', text: 'many' }
		],
		responseSignals: {
			a: ['article_determiner'],
			c: ['article_determiner']
		},
		learnerTask: {
			instructions: 'Choose the best word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'a' },
				{ id: 'b', text: 'an' },
				{ id: 'c', text: 'some' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'A single everyday noun isolates basic indefinite article selection.'
		}
	},
	{
		id: 'grammar-preposition-monday',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'language_use', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'My new class starts ____ Monday.',
		primaryScoredSignal: 'preposition',
		errorSignalTags: ['preposition'],
		explanation: 'Use "on" with a day of the week.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'at' },
			{ id: 'b', text: 'in' },
			{ id: 'c', text: 'on' },
			{ id: 'd', text: 'between' }
		],
		responseSignals: {
			a: ['preposition'],
			b: ['preposition']
		},
		learnerTask: {
			instructions: 'Choose the best word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'at' },
				{ id: 'b', text: 'in' },
				{ id: 'c', text: 'on' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Tests a common time preposition in an unambiguous sentence.'
		}
	},
	{
		id: 'vocab-delayed-train',
		version: 1,
		area: 'vocabulary',
		taskType: 'word_in_context',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'sentence_meaning', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'The train was delayed, so I arrived late.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'collocation'],
		explanation: '"Delayed" means something happened later than planned.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'very full' },
			{ id: 'b', text: 'very clean' },
			{ id: 'c', text: 'later than planned' },
			{ id: 'd', text: 'cancelled completely' }
		],
		responseSignals: {
			a: ['vocabulary_in_context'],
			b: ['vocabulary_in_context']
		},
		learnerTask: {
			instructions: 'What does "delayed" mean in this sentence?',
			choices: [
				{ id: 'a', text: 'very full' },
				{ id: 'b', text: 'very clean' },
				{ id: 'c', text: 'later than planned' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Common travel/work vocabulary with distractors that do not require outside knowledge.'
		}
	},
	{
		id: 'vocab-make-decision-collocation',
		version: 1,
		area: 'vocabulary',
		taskType: 'natural_word_pair',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'sentence_meaning', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'We need to ____ a decision before Friday.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'English normally uses the phrase "make a decision."',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'make' },
			{ id: 'b', text: 'do' },
			{ id: 'c', text: 'build' },
			{ id: 'd', text: 'put' }
		],
		responseSignals: {
			b: ['collocation'],
			c: ['collocation']
		},
		learnerTask: {
			instructions: 'Choose the natural word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'make' },
				{ id: 'b', text: 'do' },
				{ id: 'c', text: 'build' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Targets one high-frequency collocation with grammatical parallel distractors.'
		}
	},
	{
		id: 'vocab-crowded-market',
		version: 1,
		area: 'vocabulary',
		taskType: 'word_in_context',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'sentence_meaning', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'The market was crowded, so it was difficult to walk between the shops.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation: 'The difficulty walking shows that "crowded" means full of people.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'closed for the day' },
			{ id: 'b', text: 'full of people' },
			{ id: 'c', text: 'easy to find' },
			{ id: 'd', text: 'open very late' }
		],
		responseSignals: {
			a: ['vocabulary_in_context'],
			c: ['vocabulary_in_context']
		},
		learnerTask: {
			instructions: 'What does "crowded" mean in this sentence?',
			choices: [
				{ id: 'a', text: 'closed for the day' },
				{ id: 'b', text: 'full of people' },
				{ id: 'c', text: 'easy to find' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'The consequence in the sentence provides enough context for the meaning.'
		}
	},
	{
		id: 'accu-listen-aid-deadline',
		version: 1,
		area: 'listening',
		taskType: 'connected_discourse_detail',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen to a connected campus announcement and identify an important detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation:
			'Students must submit the online form by noon Wednesday; the workshop itself is Thursday afternoon.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'Bring a photo ID to room 204.' },
			{ id: 'b', text: 'Call the financial aid office.' },
			{ id: 'c', text: 'Submit the online form.' },
			{ id: 'd', text: 'Pay the workshop fee.' }
		],
		serverOnlyAudioScript:
			'The financial aid workshop will not meet in room two oh four on Tuesday as first announced. It has been moved to the library computer lab on Thursday at two fifteen. If you plan to attend, submit the online form by noon on Wednesday so the staff can prepare your account. Bring your student identification card to the workshop.',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'What must students do by noon on Wednesday?',
			choices: [
				{ id: 'a', text: 'Bring a photo ID to room 204.' },
				{ id: 'b', text: 'Call the financial aid office.' },
				{ id: 'c', text: 'Submit the online form.' },
				{ id: 'd', text: 'Pay the workshop fee.' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Original connected-discourse campus item with four choices and one explicit deadline action.'
		}
	},
	{
		id: 'accu-listen-urban-trees-purpose',
		version: 1,
		area: 'listening',
		taskType: 'connected_discourse_main_idea',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen to a short lecture and identify its main purpose.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation:
			'The speaker explains that city trees provide several benefits only when cities choose and maintain them carefully.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'To argue that every city street needs the same kind of tree.' },
			{ id: 'b', text: 'To explain the benefits of urban trees and the planning they require.' },
			{ id: 'c', text: 'To compare the cost of parks with the cost of public transportation.' },
			{ id: 'd', text: 'To describe why residents should plant trees without city support.' }
		],
		serverOnlyAudioScript:
			'Urban trees do more than make a neighborhood attractive. Their shade can lower the temperature around buildings, and their roots can slow rainwater before it reaches crowded drainage systems. However, planting any tree in any location is not enough. City planners need to choose species that fit the local climate, leave room for roots, and budget for care during the first few years. Without that planning, young trees may not survive long enough to provide the expected benefits.',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'What is the main purpose of the lecture?',
			choices: [
				{ id: 'a', text: 'To argue that every city street needs the same kind of tree.' },
				{ id: 'b', text: 'To explain the benefits of urban trees and the planning they require.' },
				{ id: 'c', text: 'To compare the cost of parks with the cost of public transportation.' },
				{ id: 'd', text: 'To describe why residents should plant trees without city support.' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Original lecture-style connected discourse; the keyed purpose integrates benefits and planning.'
		}
	},
	{
		id: 'accu-read-lab-access',
		version: 1,
		area: 'reading',
		taskType: 'reading_skills_literal_comprehension',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'reading_skills' },
		answerMode: 'choice',
		prompt:
			'The science lab is open to all students from noon until 5 p.m. On Wednesday mornings, it is reserved for classes that need the new microscopes. Students working independently may use the older microscopes in room 118 during that time. A lab assistant is available in both rooms after 1 p.m.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation:
			'Independent students can use the older microscopes in room 118 on Wednesday morning.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'Wait until 5 p.m.' },
			{ id: 'b', text: 'Join a class using the new microscopes.' },
			{ id: 'c', text: 'Ask the assistant to open the main lab.' },
			{ id: 'd', text: 'Use the older microscopes in room 118.' }
		],
		learnerTask: {
			instructions: 'What can an independent student do on Wednesday morning?',
			choices: [
				{ id: 'a', text: 'Wait until 5 p.m.' },
				{ id: 'b', text: 'Join a class using the new microscopes.' },
				{ id: 'c', text: 'Ask the assistant to open the main lab.' },
				{ id: 'd', text: 'Use the older microscopes in room 118.' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original 66-word practical passage with one supported literal-comprehension answer.'
		}
	},
	{
		id: 'accu-read-tutoring-inference',
		version: 1,
		area: 'reading',
		taskType: 'reading_skills_inference',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'reading_skills' },
		answerMode: 'choice',
		prompt:
			'Last year, the college offered peer tutoring only in the library. Attendance was low even though students who attended usually returned. This semester, tutors also hold brief sessions before evening classes. More working students now use the service, while library attendance has remained steady. The college plans to try the same schedule in two additional subjects.',
		primaryScoredSignal: 'inference',
		errorSignalTags: ['inference', 'detail'],
		explanation:
			'The new schedule reached additional working students without reducing use of the original library service.',
		answerKey: ['a'],
		choices: [
			{
				id: 'a',
				text: 'Offering tutoring at another time made the service useful to more students.'
			},
			{ id: 'b', text: 'Students prefer tutoring in the library to tutoring before class.' },
			{ id: 'c', text: 'The college will replace peer tutors with subject instructors.' },
			{ id: 'd', text: 'Evening students stopped using the library after tutoring expanded.' }
		],
		learnerTask: {
			instructions: 'What conclusion is best supported by the passage?',
			choices: [
				{
					id: 'a',
					text: 'Offering tutoring at another time made the service useful to more students.'
				},
				{ id: 'b', text: 'Students prefer tutoring in the library to tutoring before class.' },
				{ id: 'c', text: 'The college will replace peer tutors with subject instructors.' },
				{ id: 'd', text: 'Evening students stopped using the library after tutoring expanded.' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original moderate-length passage requiring a supported cause-and-effect inference.'
		}
	},
	{
		id: 'accu-language-combine-result',
		version: 1,
		area: 'grammar_usage',
		taskType: 'language_use_sentence_combining',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'language_use' },
		answerMode: 'choice',
		prompt: 'The first result was unclear. The researchers repeated the experiment.',
		primaryScoredSignal: 'sentence_control',
		errorSignalTags: ['sentence_control', 'verb_form'],
		explanation:
			'“Because” correctly expresses that the unclear result caused the researchers to repeat the experiment.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'The first result was unclear, but repeating the experiment.' },
			{
				id: 'b',
				text: 'Because the first result was unclear, the researchers repeated the experiment.'
			},
			{ id: 'c', text: 'The researchers repeated, the experiment was an unclear result.' },
			{
				id: 'd',
				text: 'Although the first result was unclear, so the researchers repeated the experiment.'
			}
		],
		learnerTask: {
			instructions:
				'Choose the sentence that best combines the two ideas without changing their meaning.',
			choices: [
				{ id: 'a', text: 'The first result was unclear, but repeating the experiment.' },
				{
					id: 'b',
					text: 'Because the first result was unclear, the researchers repeated the experiment.'
				},
				{ id: 'c', text: 'The researchers repeated, the experiment was an unclear result.' },
				{
					id: 'd',
					text: 'Although the first result was unclear, so the researchers repeated the experiment.'
				}
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original Language Use sentence-combining task with one grammatical causal relation.'
		}
	},
	{
		id: 'accu-language-complex-agreement',
		version: 1,
		area: 'grammar_usage',
		taskType: 'language_use_fill_in_blank',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'language_use' },
		answerMode: 'choice',
		prompt: 'Neither the instructor nor the students ____ aware that the schedule had changed.',
		primaryScoredSignal: 'subject_verb_agreement',
		errorSignalTags: ['subject_verb_agreement', 'verb_form'],
		explanation:
			'With “neither ... nor,” the verb agrees with the nearer subject “students,” so “were” is correct.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'is' },
			{ id: 'b', text: 'was' },
			{ id: 'c', text: 'were' },
			{ id: 'd', text: 'be' }
		],
		learnerTask: {
			instructions: 'Choose the option that makes the sentence grammatically correct.',
			choices: [
				{ id: 'a', text: 'is' },
				{ id: 'b', text: 'was' },
				{ id: 'c', text: 'were' },
				{ id: 'd', text: 'be' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original higher-level agreement task with an unambiguous plural nearer subject.'
		}
	},
	{
		id: 'accu-meaning-put-off',
		version: 1,
		area: 'vocabulary',
		taskType: 'sentence_meaning_fill_in_blank',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'sentence_meaning' },
		answerMode: 'choice',
		prompt:
			'Because two members were absent, the committee decided to put off the vote until Monday.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'In this context, “put off” means postpone or delay until a later time.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'postpone' },
			{ id: 'b', text: 'cancel permanently' },
			{ id: 'c', text: 'record' },
			{ id: 'd', text: 'repeat immediately' }
		],
		learnerTask: {
			instructions: 'What does “put off” mean in this sentence?',
			choices: [
				{ id: 'a', text: 'postpone' },
				{ id: 'b', text: 'cancel permanently' },
				{ id: 'c', text: 'record' },
				{ id: 'd', text: 'repeat immediately' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original Sentence Meaning item testing a common two-word verb in clear context.'
		}
	},
	{
		id: 'accu-meaning-concession-paraphrase',
		version: 1,
		area: 'vocabulary',
		taskType: 'sentence_meaning_paraphrase',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'sentence_meaning' },
		answerMode: 'choice',
		prompt:
			'Although the proposal would reduce costs, the director rejected it because it might also reduce access to the program.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'main_idea'],
		explanation:
			'The director rejected a money-saving proposal because the possible loss of access mattered more.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'The director believed the proposal would increase both costs and access.' },
			{ id: 'b', text: 'The director accepted the proposal after learning it would save money.' },
			{ id: 'c', text: 'The director rejected the proposal because it would not reduce costs.' },
			{ id: 'd', text: 'The director valued access more than the proposal’s possible savings.' }
		],
		learnerTask: {
			instructions: 'Which sentence has the closest meaning?',
			choices: [
				{
					id: 'a',
					text: 'The director believed the proposal would increase both costs and access.'
				},
				{ id: 'b', text: 'The director accepted the proposal after learning it would save money.' },
				{ id: 'c', text: 'The director rejected the proposal because it would not reduce costs.' },
				{ id: 'd', text: 'The director valued access more than the proposal’s possible savings.' }
			]
		},
		review: {
			authoringSessionId: 'codex-accuplacer-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-accuplacer-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original complex-sentence paraphrase with one complete concession interpretation.'
		}
	},
	{
		id: 'cept-listen-tutorial-change',
		version: 1,
		area: 'listening',
		taskType: 'cept_extended_listening_detail',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'listening' },
		stimulusGroupId: 'cept-a-bicycle-study',
		stimulusOrder: 1,
		answerMode: 'choice',
		prompt: 'Listen to the extended report and answer the first question.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation:
			'Free repair events increased interest briefly, but the recording says the effect did not last.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'Interest increased for a few weeks.' },
			{ id: 'b', text: 'Students stopped using protected routes.' },
			{ id: 'c', text: 'The university cancelled its survey.' }
		],
		serverOnlyAudioScript: ceptFormAListeningStimulus,
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'What happened after the free repair events?',
			choices: [
				{ id: 'a', text: 'Interest increased for a few weeks.' },
				{ id: 'b', text: 'Students stopped using protected routes.' },
				{ id: 'c', text: 'The university cancelled its survey.' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'First question in an original two-question CEPT extended-listening set; tests an ordered supporting detail.'
		}
	},
	{
		id: 'cept-listen-bicycle-study',
		version: 1,
		area: 'listening',
		taskType: 'cept_extended_listening',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'listening' },
		stimulusGroupId: 'cept-a-bicycle-study',
		stimulusOrder: 2,
		answerMode: 'choice',
		prompt: 'Listen to a longer recording and identify the speaker’s main conclusion.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation:
			'The study found that protected routes, more than bicycle ownership alone, were linked to regular cycling.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'Most students did not own bicycles.' },
			{ id: 'b', text: 'Free repairs were the main reason students cycled.' },
			{ id: 'c', text: 'Safer routes appeared to encourage regular cycling.' }
		],
		serverOnlyAudioScript: ceptFormAListeningStimulus,
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'What is the speaker’s main conclusion?',
			choices: [
				{ id: 'a', text: 'Most students did not own bicycles.' },
				{ id: 'b', text: 'Free repairs were the main reason students cycled.' },
				{ id: 'c', text: 'Safer routes appeared to encourage regular cycling.' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Original extended-listening sample with ordered evidence and three parallel conclusions.'
		}
	},
	{
		id: 'cept-read-select-study-center-notice',
		version: 1,
		area: 'reading',
		taskType: 'cept_read_and_select',
		difficulty: 'foundation',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'NOTICE: The study center will close at 4:00 on Friday for staff training. Students who need evening computer access can use the main library until 9:00.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation:
			'Friday evening computer access remains available in the main library after the study center closes.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'The study center will remain open until 9:00 on Friday.' },
			{ id: 'b', text: 'Students can use library computers on Friday evening.' },
			{ id: 'c', text: 'Both the study center and main library will close at 4:00.' }
		],
		learnerTask: {
			instructions: 'Choose the sentence that most closely matches the meaning of the notice.',
			choices: [
				{ id: 'a', text: 'The study center will remain open until 9:00 on Friday.' },
				{ id: 'b', text: 'Students can use library computers on Friday evening.' },
				{ id: 'c', text: 'Both the study center and main library will close at 4:00.' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-read-select-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-read-select-content-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Original CEPT read-and-select notice with three sentence alternatives and one complete meaning match.'
		}
	},
	{
		id: 'cept-read-west-entrance',
		version: 1,
		area: 'reading',
		taskType: 'cept_extended_reading_detail',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		stimulusGroupId: 'cept-a-community-garden',
		stimulusOrder: 1,
		answerMode: 'choice',
		prompt: ceptFormAReadingStimulus,
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'The group improved drainage by raising the planting beds.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'They requested fewer garden plots.' },
			{ id: 'b', text: 'They moved the garden beside the school.' },
			{ id: 'c', text: 'They raised the planting beds.' },
			{ id: 'd', text: 'They stopped sharing equipment.' }
		],
		learnerTask: {
			instructions: 'What did residents do after poor drainage damaged crops?',
			choices: [
				{ id: 'a', text: 'They requested fewer garden plots.' },
				{ id: 'b', text: 'They moved the garden beside the school.' },
				{ id: 'c', text: 'They raised the planting beds.' },
				{ id: 'd', text: 'They stopped sharing equipment.' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'First question in an original three-question CEPT extended-reading set; tests an ordered supporting detail.'
		}
	},
	{
		id: 'cept-read-community-garden',
		version: 1,
		area: 'reading',
		taskType: 'cept_extended_reading',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		stimulusGroupId: 'cept-a-community-garden',
		stimulusOrder: 2,
		answerMode: 'choice',
		prompt: ceptFormAReadingStimulus,
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail', 'vocabulary_in_context'],
		explanation:
			'The passage emphasizes how residents improved an initially difficult project and created a useful shared place.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'Officials designed a successful garden before residents became involved.' },
			{
				id: 'b',
				text: 'Residents adapted the garden project after early problems and made it useful.'
			},
			{ id: 'c', text: 'The school took control of the garden after the first harvest failed.' },
			{ id: 'd', text: 'The garden ended disagreements throughout the neighborhood.' }
		],
		learnerTask: {
			instructions: 'What is the main idea of the passage?',
			choices: [
				{
					id: 'a',
					text: 'Officials designed a successful garden before residents became involved.'
				},
				{
					id: 'b',
					text: 'Residents adapted the garden project after early problems and made it useful.'
				},
				{ id: 'c', text: 'The school took control of the garden after the first harvest failed.' },
				{ id: 'd', text: 'The garden ended disagreements throughout the neighborhood.' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original extended-reading passage with one whole-text main-idea question.'
		}
	},
	{
		id: 'cept-extended-substantial-context',
		version: 1,
		area: 'vocabulary',
		taskType: 'cept_extended_reading_vocabulary',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		stimulusGroupId: 'cept-a-community-garden',
		stimulusOrder: 3,
		answerMode: 'choice',
		prompt: ceptFormAReadingStimulus,
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation:
			'The land had not been used or cared for before the garden project, so “neglected” means left without care or use.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'left without care or use' },
			{ id: 'b', text: 'carefully protected' },
			{ id: 'c', text: 'recently purchased' },
			{ id: 'd', text: 'reserved for officials' }
		],
		learnerTask: {
			instructions: 'What does “neglected” most nearly mean in the final sentence?',
			choices: [
				{ id: 'a', text: 'left without care or use' },
				{ id: 'b', text: 'carefully protected' },
				{ id: 'c', text: 'recently purchased' },
				{ id: 'd', text: 'reserved for officials' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Third question in the original CEPT extended-reading series; tests vocabulary from the shared passage.'
		}
	},
	{
		id: 'cept-gap-had-taken',
		version: 1,
		area: 'grammar_usage',
		taskType: 'cept_gapped_sentence',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'By the time the seminar started, most participants ____ their seats.',
		primaryScoredSignal: 'verb_form',
		errorSignalTags: ['verb_form'],
		explanation:
			'The taking of the seats happened before another past event, so the past perfect “had taken” is correct.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'take' },
			{ id: 'b', text: 'have taken' },
			{ id: 'c', text: 'were taking' },
			{ id: 'd', text: 'had taken' }
		],
		learnerTask: {
			instructions: 'Choose the correct option for the gap.',
			choices: [
				{ id: 'a', text: 'take' },
				{ id: 'b', text: 'have taken' },
				{ id: 'c', text: 'were taking' },
				{ id: 'd', text: 'had taken' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original four-option CEPT gapped sentence with clear past-perfect sequencing.'
		}
	},
	{
		id: 'cept-open-gap-intended-for',
		version: 1,
		area: 'grammar_usage',
		taskType: 'cept_open_gap_fill',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'short_text',
		prompt:
			'The evening course is intended ____ students who work during the day. Only one word is missing.',
		primaryScoredSignal: 'preposition',
		errorSignalTags: ['preposition', 'collocation'],
		explanation: 'The fixed pattern is “be intended for” a person or group.',
		answerKey: ['for'],
		learnerTask: {
			instructions: 'Type the one missing word.'
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original single-word CEPT open-gap item with one exact normalized answer.'
		}
	},
	{
		id: 'cept-mcq-gap-conduct-study',
		version: 1,
		area: 'vocabulary',
		taskType: 'cept_multiple_choice_gap_fill',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'The university plans to ____ a survey before it changes the bus timetable, so that students can describe their current journeys.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'English commonly uses the collocation “conduct a survey.”',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'perform' },
			{ id: 'b', text: 'operate' },
			{ id: 'c', text: 'conduct' },
			{ id: 'd', text: 'direct' }
		],
		learnerTask: {
			instructions: 'Choose the correct word for the gap.',
			choices: [
				{ id: 'a', text: 'perform' },
				{ id: 'b', text: 'operate' },
				{ id: 'c', text: 'conduct' },
				{ id: 'd', text: 'direct' }
			]
		},
		review: {
			authoringSessionId: 'codex-cept-ceiling-authoring-2026-07-11',
			reviewSessionId: 'codex-cept-ceiling-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Original four-option lexical gap testing a common academic collocation.'
		}
	},
	{
		id: 'accu-writeplacer-community-change',
		version: 1,
		area: 'writing',
		taskType: 'writeplacer_esl_readiness_essay',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'writeplacer_esl' },
		prompt:
			'Write an essay about one change that would improve your school, workplace, or community. Explain the change, give reasons for it, and support your position with specific examples.',
		errorSignalTags: [
			'task_completion',
			'article_determiner',
			'plural_countability',
			'verb_form',
			'subject_verb_agreement',
			'sentence_control',
			'collocation',
			'clarity'
		],
		explanation:
			'The essay should state a clear position, develop it with relevant reasons and examples, and maintain understandable organization and language control.',
		rubric: [
			'score_0: off topic, not in English, too short to review, or meaning cannot be recovered',
			'score_1: gives a position with little development; organization or frequent language problems often interrupt meaning',
			'score_2: gives a clear position with relevant reasons or examples; organization is generally clear and recurring errors do not prevent understanding',
			'score_3: writes 300–600 relevant words; develops a clear position with specific support, controlled organization, and mostly effective language',
			'task_completion: writes 300–600 relevant words and answers every part of the prompt',
			'organization: introduces a position, develops reasons and examples, and reaches a clear conclusion',
			'clarity: ideas and relationships are understandable without guessing',
			'grammar_control: reviews agreement, verb forms, articles, plurals, and sentence boundaries',
			'vocabulary: uses sufficiently precise words and natural combinations for the chosen context'
		],
		learnerTask: {
			instructions:
				'Write 300–600 words. State your position, explain your reasons, and support them with specific examples. This receives only an internal 0–3 readiness review, not an official WritePlacer ESL 1–6 score.'
		},
		review: {
			authoringSessionId: 'codex-writeplacer-readiness-authoring-2026-07-11',
			reviewSessionId: 'codex-writeplacer-readiness-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Original extended opinion prompt aligned to essay-preparation length while explicitly retaining an internal, uncalibrated rubric.'
		}
	},
	{
		id: 'write-problem-solved-last-week',
		version: 1,
		area: 'writing',
		taskType: 'short_paragraph',
		prompt: 'Write 4-5 sentences about a problem you solved last week.',
		errorSignalTags: [
			'task_completion',
			'article_determiner',
			'plural_countability',
			'verb_form',
			'subject_verb_agreement',
			'sentence_control',
			'clarity'
		],
		explanation:
			'The response should describe a familiar past event with clear sentence control and basic grammar accuracy.',
		rubric: [
			'task_completion: answers the prompt with 4-5 relevant sentences',
			'clarity: ideas are understandable without guessing',
			'grammar_control: checks tense, articles, plurals, and sentence boundaries',
			'vocabulary: uses familiar words accurately'
		],
		learnerTask: {
			instructions: 'Write 4-5 sentences about a problem you solved last week.'
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Familiar prompt supports beginner output and maps directly to planned writing signals.'
		}
	},
	{
		id: 'write-problem-solved-last-week',
		version: 2,
		area: 'writing',
		taskType: 'placement_readiness_paragraph',
		prompt:
			'Write 120–180 words about a problem you solved at school, work, or home. Explain what happened, the steps you took, and the result.',
		errorSignalTags: [
			'task_completion',
			'article_determiner',
			'plural_countability',
			'verb_form',
			'subject_verb_agreement',
			'sentence_control',
			'collocation',
			'clarity'
		],
		explanation:
			'The response should address all three parts, organize events in a clear sequence, and provide enough connected writing to review grammar, vocabulary, and sentence control.',
		rubric: [
			'score_0: off topic, not in English, too short to review, or meaning cannot be recovered',
			'score_1: addresses only part of the task; limited sequence; frequent grammar or word-choice problems often interrupt meaning',
			'score_2: addresses the problem, steps, and result with generally clear organization; recurring errors are present but meaning stays understandable',
			'score_3: writes 120–180 relevant words; fully develops all three parts in a clear sequence; word choice and sentence control are mostly accurate',
			'task_completion: writes 120–180 relevant words and addresses the problem, steps, and result',
			'organization: sequences the response with a clear beginning, development, and outcome',
			'clarity: ideas are understandable without guessing',
			'grammar_control: reviews tense, agreement, articles, plurals, and sentence boundaries',
			'vocabulary: uses accurate words and natural combinations for the chosen context'
		],
		learnerTask: {
			instructions:
				'Write 120–180 words. Explain the problem, the steps you took, and the result. Spend a minute planning before you write.'
		},
		review: {
			authoringSessionId: 'codex-placement-writing-authoring-2026-07-11',
			reviewSessionId: 'codex-placement-writing-content-review-2026-07-11',
			reviewedAt: '2026-07-11',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Longer familiar-context response follows the repository research target while remaining explicitly a readiness baseline rather than a scored WritePlacer simulation.'
		}
	},
	{
		id: 'speak-recent-purchase',
		version: 1,
		area: 'speaking',
		taskType: 'recorded_short_answer',
		prompt: 'Tell me about something you bought recently. What was it, and why did you buy it?',
		errorSignalTags: ['task_completion', 'clarity', 'fluency', 'verb_form', 'sentence_control'],
		explanation:
			'The response should name the item, explain the reason, and stay understandable in a short answer.',
		rubric: [
			'task_completion: names a recent purchase and gives a reason',
			'clarity: meaning is understandable',
			'fluency: answer is not blocked by long pauses',
			'grammar_control: basic past-tense and sentence control are usable'
		],
		learnerTask: {
			instructions:
				'Record a short answer: Tell me about something you bought recently. What was it, and why did you buy it?'
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Safe everyday topic; no long-term audio storage implied by the seed item.'
		}
	}
] as const satisfies readonly Omit<AssessmentItem, 'formId'>[];

const withDefaultResponseSignals = (item: AssessmentItem): AssessmentItem => {
	if (
		item.answerMode !== 'choice' ||
		!item.choices ||
		!item.answerKey?.length ||
		!item.primaryScoredSignal
	) {
		return item;
	}

	const correctAnswers = new Set(item.answerKey);
	return {
		...item,
		responseSignals: Object.fromEntries(
			item.choices
				.filter((choice) => !correctAnswers.has(choice.id))
				.map((choice) => [
					choice.id,
					item.responseSignals?.[choice.id] ?? [item.primaryScoredSignal!]
				])
		)
	};
};

export const seedAssessmentItems: readonly AssessmentItem[] = [
	...assessmentFormAItems.map((item) =>
		withDefaultResponseSignals({
			...item,
			formId: 'A' as const,
			learnerTask: {
				...item.learnerTask,
				...('choices' in item ? { choices: item.choices } : {})
			}
		})
	),
	...assessmentFormBItems.map(withDefaultResponseSignals)
];

export function getSeedAssessmentItems(): readonly AssessmentItem[] {
	validateSeedAssessmentItems(seedAssessmentItems);
	return seedAssessmentItems;
}

const currentAssessmentItems = (items: readonly AssessmentItem[]) => {
	const current = new Map<string, AssessmentItem>();
	for (const item of items) {
		if (!current.has(item.id) || current.get(item.id)!.version < item.version) {
			current.set(item.id, item);
		}
	}
	return [...current.values()];
};

export type AssessmentSelectionKind = ProfiledAssessmentKind | 'school_specific' | 'not_sure';

const ceptReplacedSharedReadingItemIds = new Set([
	'read-omar-library-main-idea',
	'read-priya-center-main-idea-b'
]);

const itemMatchesProfile = (item: AssessmentItem, profile: ProfiledAssessmentKind) =>
	item.profile === profile ||
	(item.profile === 'shared' &&
		!(profile === 'cambridge_cept' && ceptReplacedSharedReadingItemIds.has(item.id)));

const ceptChoiceCountsByTaskType: Readonly<Partial<Record<string, 3 | 4>>> = {
	cept_read_and_select: 3,
	short_audio_comprehension: 3,
	short_passage_comprehension: 3,
	vocabulary_in_passage: 3,
	word_in_context: 3,
	fill_in_the_blank: 4,
	natural_word_pair: 4,
	cept_extended_listening_detail: 3,
	cept_extended_listening: 3,
	cept_extended_reading_detail: 4,
	cept_extended_reading: 4,
	cept_extended_reading_vocabulary: 4,
	cept_gapped_sentence: 4,
	cept_multiple_choice_gap_fill: 4
};

export const ceptChoiceCountForTaskType = (taskType: string) =>
	ceptChoiceCountsByTaskType[taskType];

export function getAssessmentItemsForProfile(
	kind: AssessmentSelectionKind = 'not_sure',
	options: {
		areas?: ReadonlySet<AssessmentArea>;
		includeAccuplacerWriting?: boolean;
		formId?: AssessmentFormId;
	} = {}
): AssessmentItem[] {
	return currentAssessmentItems(getSeedAssessmentItems()).filter((item) => {
		if (item.formId !== (options.formId ?? 'A')) return false;
		if (options.areas && !options.areas.has(item.area)) return false;
		if (kind === 'accuplacer_esl' || kind === 'cambridge_cept') {
			if (item.area === 'writing') {
				return (
					kind === 'accuplacer_esl' &&
					options.includeAccuplacerWriting === true &&
					item.profile === kind
				);
			}
			if (item.area === 'speaking') return false;
			return itemMatchesProfile(item, kind);
		}
		return item.profile === 'shared' || item.profile === undefined;
	});
}

export function getLearnerAssessmentItems(
	kind: AssessmentSelectionKind = 'not_sure',
	options: Parameters<typeof getAssessmentItemsForProfile>[1] = {}
): LearnerAssessmentItem[] {
	return getAssessmentItemsForProfile(kind, options).map((item) =>
		toLearnerAssessmentItem(item, kind)
	);
}

const toLearnerAssessmentItem = (
	{
		id,
		version,
		formId,
		area,
		taskType,
		prompt,
		answerMode,
		stimulusGroupId,
		stimulusOrder,
		learnerTask,
		choices,
		answerKey,
		serverOnlyAudioScript
	}: AssessmentItem,
	kind: AssessmentSelectionKind = 'not_sure'
): LearnerAssessmentItem => {
	const visibleChoices = learnerChoicesForProfile(taskType, choices, answerKey, kind);
	return {
		id,
		version,
		formId,
		area,
		taskType,
		prompt,
		answerMode,
		stimulusGroupId,
		stimulusOrder,
		learnerTask: {
			...learnerTask,
			...(visibleChoices ? { choices: visibleChoices } : {})
		},
		...(serverOnlyAudioScript ? { audioUrl: `/assessment/audio/${id}?version=${version}` } : {})
	};
};

const learnerChoicesForProfile = (
	taskType: string,
	choices: readonly Choice[] | undefined,
	answerKey: readonly string[] | undefined,
	kind: AssessmentSelectionKind
) => {
	const desiredCount = kind === 'cambridge_cept' ? ceptChoiceCountForTaskType(taskType) : undefined;
	if (!choices || !desiredCount || choices.length <= desiredCount) return choices;

	const keyedIds = new Set(answerKey ?? []);
	const keyedChoices = choices.filter((choice) => keyedIds.has(choice.id));
	const distractors = choices
		.filter((choice) => !keyedIds.has(choice.id))
		.slice(0, Math.max(0, desiredCount - keyedChoices.length));
	const visibleIds = new Set([...keyedChoices, ...distractors].map((choice) => choice.id));

	return choices.filter((choice) => visibleIds.has(choice.id));
};

export function getAssessmentItemVersion(itemId: string, itemVersion: number) {
	return getSeedAssessmentItems().find(
		(candidate) => candidate.id === itemId && candidate.version === itemVersion
	);
}

export function getCurrentAssessmentItem(itemId: string) {
	return currentAssessmentItems(getSeedAssessmentItems()).find(
		(candidate) => candidate.id === itemId
	);
}

export function getLearnerAssessmentItemVersion(
	itemId: string,
	itemVersion: number,
	kind: AssessmentSelectionKind = 'not_sure'
) {
	const item = getAssessmentItemVersion(itemId, itemVersion);
	return item ? toLearnerAssessmentItem(item, kind) : undefined;
}

export function getAssessmentItemAudioSource(itemId: string, itemVersion?: number) {
	const item = itemVersion
		? getAssessmentItemVersion(itemId, itemVersion)
		: currentAssessmentItems(getSeedAssessmentItems()).find((candidate) => candidate.id === itemId);
	if (!item?.serverOnlyAudioScript || !item.serverOnlyAudioMetadata) return;

	return {
		itemId: item.id,
		itemVersion: item.version,
		script: item.serverOnlyAudioScript,
		metadata: item.serverOnlyAudioMetadata
	};
}

export function getAssessmentResponseSignals(itemId: string, answer: string): ErrorSignal[];
export function getAssessmentResponseSignals(
	itemId: string,
	itemVersion: number,
	answer: string
): ErrorSignal[];
export function getAssessmentResponseSignals(
	itemId: string,
	itemVersionOrAnswer: number | string,
	maybeAnswer?: string
): ErrorSignal[] {
	const item =
		typeof itemVersionOrAnswer === 'number'
			? getAssessmentItemVersion(itemId, itemVersionOrAnswer)
			: currentAssessmentItems(getSeedAssessmentItems()).find(
					(candidate) => candidate.id === itemId
				);
	const answer = typeof itemVersionOrAnswer === 'string' ? itemVersionOrAnswer : maybeAnswer;
	return answer ? [...(item?.responseSignals?.[answer] ?? [])] : [];
}

export function validateSeedAssessmentItems(items: readonly AssessmentItem[]) {
	const requiredAreas = new Set<AssessmentArea>([
		'listening',
		'reading',
		'grammar_usage',
		'vocabulary',
		'writing',
		'speaking'
	]);

	const versions = new Set<string>();

	for (const item of items) {
		const versionKey = `${item.id}:${item.version}`;
		if (versions.has(versionKey)) throw new Error(`Duplicate Assessment Item ${versionKey}`);
		versions.add(versionKey);

		if (
			!item.id ||
			item.version < 1 ||
			!assessmentFormIds.includes(item.formId) ||
			!item.prompt ||
			!item.learnerTask.instructions ||
			!item.explanation
		) {
			throw new Error(`Assessment Item ${item.id || '(missing id)'} is missing required fields`);
		}

		if (item.errorSignalTags.length === 0) {
			throw new Error(`Assessment Item ${item.id} is missing Error Signal tags`);
		}

		if (
			item.answerKey?.length &&
			(!item.primaryScoredSignal || !item.errorSignalTags.includes(item.primaryScoredSignal))
		) {
			throw new Error(`Assessment Item ${item.id} needs one tagged primary scored signal`);
		}

		if (item.answerKey?.length && !item.answerMode) {
			throw new Error(`Assessment Item ${item.id} is missing an objective answer mode`);
		}

		if (
			item.answerMode === 'choice' &&
			item.answerKey?.some((answer) => !item.choices?.some((choice) => choice.id === answer))
		) {
			throw new Error(`Assessment Item ${item.id} answer key must match a choice`);
		}
		if (item.answerMode === 'choice') {
			if (!item.choices || item.choices.length < 3) {
				throw new Error(`Assessment Item ${item.id} needs at least three choices`);
			}
			if (
				new Set(item.choices.map((choice) => choice.id)).size !== item.choices.length ||
				new Set(item.choices.map((choice) => choice.text)).size !== item.choices.length
			) {
				throw new Error(`Assessment Item ${item.id} choices must be distinct`);
			}
			if (JSON.stringify(item.learnerTask.choices) !== JSON.stringify(item.choices)) {
				throw new Error(`Assessment Item ${item.id} learner choices must match its answer choices`);
			}
		}
		if (item.answerMode === 'short_text' && item.choices?.length) {
			throw new Error(`Assessment Item ${item.id} open response must not include choices`);
		}
		if (item.answerKey?.length && (!item.difficulty || !item.profile || !item.profileSections)) {
			throw new Error(`Assessment Item ${item.id} is missing placement profile metadata`);
		}

		if (item.serverOnlyAudioScript && !item.serverOnlyAudioMetadata) {
			throw new Error(`Assessment Item ${item.id} is missing generated audio metadata`);
		}
		if (Boolean(item.stimulusGroupId) !== Boolean(item.stimulusOrder)) {
			throw new Error(`Assessment Item ${item.id} has incomplete stimulus-series metadata`);
		}

		if (!item.answerKey?.length && !item.rubric?.length) {
			throw new Error(`Assessment Item ${item.id} needs an answer key or rubric`);
		}

		if (item.choices?.length) {
			const choiceIds = new Set(item.choices.map((choice) => choice.id));
			const answerKeys = new Set(item.answerKey ?? []);
			if (!item.responseSignals) {
				throw new Error(`Assessment Item ${item.id} needs response-to-signal mappings`);
			}

			for (const [answerId, signals] of Object.entries(item.responseSignals) as [
				string,
				readonly ErrorSignal[]
			][]) {
				if (!choiceIds.has(answerId)) {
					throw new Error(`Assessment Item ${item.id} maps a response that is not a choice`);
				}
				if (answerKeys.has(answerId)) {
					throw new Error(`Assessment Item ${item.id} must not diagnose a correct response`);
				}
				if (signals.length === 0) {
					throw new Error(`Assessment Item ${item.id} maps a response without an Error Signal`);
				}
			}

			for (const choiceId of choiceIds) {
				if (!answerKeys.has(choiceId) && !item.responseSignals[choiceId]?.length) {
					throw new Error(`Assessment Item ${item.id} is missing a response-to-signal mapping`);
				}
			}
		}

		if (
			!item.review.authoringSessionId ||
			!item.review.reviewSessionId ||
			!item.review.reviewedAt ||
			!item.review.reviewerModel ||
			!item.review.notes ||
			item.review.status !== 'accepted'
		) {
			throw new Error(`Assessment Item ${item.id} is missing AI Content Review metadata`);
		}

		if (item.review.authoringSessionId === item.review.reviewSessionId) {
			throw new Error(`Assessment Item ${item.id} review must be separate from authoring`);
		}
	}

	const currentItems = currentAssessmentItems(items);
	for (const item of currentItems) {
		requiredAreas.delete(item.area);
	}

	if (requiredAreas.size > 0) {
		throw new Error(`Assessment Item bank missing areas: ${[...requiredAreas].join(', ')}`);
	}

	for (const formId of assessmentFormIds) {
		const formItems = currentItems.filter((item) => item.formId === formId);
		for (const area of ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const) {
			const shared = formItems.filter(
				(item) =>
					item.area === area && item.profile === 'shared' && item.difficulty === 'foundation'
			);
			if (shared.length !== 3) {
				throw new Error(`Assessment form ${formId} needs three shared foundation ${area} items`);
			}
			if (shared.some((item) => item.answerMode !== 'choice' || item.choices?.length !== 4)) {
				throw new Error(
					`Assessment form ${formId} shared foundation ${area} items need four choices`
				);
			}
			for (const profile of profiledAssessmentKinds) {
				const overlay = formItems.filter((item) => item.area === area && item.profile === profile);
				const hasDedicatedFoundation = profile === 'cambridge_cept' && area === 'reading';
				if (
					overlay.length !== (hasDedicatedFoundation ? 3 : 2) ||
					overlay.filter((item) => item.difficulty === 'foundation').length !==
						(hasDedicatedFoundation ? 1 : 0) ||
					overlay.filter((item) => item.difficulty === 'intermediate').length !== 1 ||
					overlay.filter((item) => item.difficulty === 'challenge').length !== 1
				) {
					throw new Error(
						`Assessment form ${formId} has an invalid reviewed ${area} overlay for ${profile}`
					);
				}
				const selectedAreaItems = formItems.filter(
					(item) => item.area === area && itemMatchesProfile(item, profile)
				);
				if (
					selectedAreaItems.length !== 5 ||
					selectedAreaItems.filter((item) => item.difficulty === 'foundation').length !== 3 ||
					selectedAreaItems.filter((item) => item.difficulty === 'intermediate').length !== 1 ||
					selectedAreaItems.filter((item) => item.difficulty === 'challenge').length !== 1
				) {
					throw new Error(
						`Assessment form ${formId} needs three foundation, one intermediate, and one challenge ${area} item for ${profile}`
					);
				}
				if (
					profile === 'accuplacer_esl' &&
					overlay.some((item) => item.answerMode !== 'choice' || item.choices?.length !== 4)
				) {
					throw new Error(`Assessment form ${formId} ACCUPLACER ${area} items need four choices`);
				}
			}
		}
		if (
			formItems.filter((item) => item.profile === 'shared' || item.profile === undefined).length !==
			14
		) {
			throw new Error(`General assessment form ${formId} needs exactly 14 current items`);
		}
		for (const profile of profiledAssessmentKinds) {
			if (
				formItems.filter(
					(item) =>
						item.area !== 'writing' && item.area !== 'speaking' && itemMatchesProfile(item, profile)
				).length !== 20
			) {
				throw new Error(`${profile} assessment form ${formId} needs exactly 20 objective items`);
			}
		}
		for (const item of formItems.filter(
			(item) =>
				item.answerMode === 'choice' &&
				(item.profile === 'shared' || item.profile === 'cambridge_cept')
		)) {
			const expectedChoiceCount = ceptChoiceCountForTaskType(item.taskType);
			if (!expectedChoiceCount) {
				throw new Error(`CEPT task type ${item.taskType} is missing a choice-count rule`);
			}
			if (!item.choices || item.choices.length < expectedChoiceCount) {
				throw new Error(
					`CEPT task ${item.id} needs at least ${expectedChoiceCount} authored choices`
				);
			}
		}

		const ceptSeries = formItems.filter(
			(item) => item.profile === 'cambridge_cept' && item.stimulusGroupId
		);
		for (const [seriesType, expectedLength] of [
			['listening', 2],
			['reading', 3]
		] as const) {
			const series = ceptSeries
				.filter((item) => item.taskType.startsWith(`cept_extended_${seriesType}`))
				.sort((left, right) => (left.stimulusOrder ?? 0) - (right.stimulusOrder ?? 0));
			const first = series[0];
			const indexes = series.map((item) => formItems.indexOf(item));
			if (
				series.length !== expectedLength ||
				series.some((item, index) => item.stimulusOrder !== index + 1) ||
				series.some((item) => item.stimulusGroupId !== first?.stimulusGroupId) ||
				series.some((item) =>
					seriesType === 'listening'
						? item.serverOnlyAudioScript !== first?.serverOnlyAudioScript
						: item.prompt !== first?.prompt
				) ||
				indexes.some((index, position) => index !== indexes[0] + position)
			) {
				throw new Error(
					`CEPT form ${formId} needs one consecutive ordered shared-stimulus ${seriesType} series`
				);
			}
		}
	}
}
