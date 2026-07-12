import type { AssessmentItem, ReviewMetadata } from './assessment-items';

type FormBItemInput = Omit<AssessmentItem, 'version' | 'formId' | 'learnerTask' | 'review'> & {
	readonly instructions: string;
	readonly reviewNotes: string;
};

const reviewed = (itemId: string, notes: string): ReviewMetadata => ({
	authoringSessionId: `codex-assessment-form-b-authoring-${itemId}-2026-07-11`,
	reviewSessionId: `codex-assessment-form-b-content-review-${itemId}-2026-07-11`,
	reviewedAt: '2026-07-11',
	reviewerModel: 'gpt-5',
	status: 'accepted',
	notes
});

const formBItem = ({ instructions, reviewNotes, ...item }: FormBItemInput): AssessmentItem => ({
	...item,
	version: 1,
	formId: 'B',
	learnerTask: {
		instructions,
		...(item.choices ? { choices: item.choices } : {})
	},
	review: reviewed(item.id, reviewNotes)
});

const audioMetadata = {
	provider: 'workers-ai',
	model: '@cf/deepgram/aura-2-en',
	schemaVersion: 1
} as const;

const ceptFormBListeningStimulus =
	'A college reviewed why some part-time students left online courses before the end of term. The researchers first expected lack of computer access to be the main cause, but most students had reliable devices. Interviews instead showed that changing work schedules often made fixed weekly deadlines difficult. In a pilot program, students could complete two assignments within a wider ten-day window, and advisers contacted anyone who missed the first checkpoint. More students finished the pilot courses. The college concluded that flexibility was most useful when it was combined with early personal support.';

const ceptFormBReadingStimulus =
	'A group of volunteers opened a monthly repair café where residents could bring broken household items. At first, the organizers expected most visitors to leave their objects and return later. Instead, many wanted to watch and learn. The volunteers changed the format so each visitor worked beside a repairer. Some objects still could not be fixed, but visitors reported that they felt more confident attempting simple repairs at home. The organizers then added short workshops on maintaining bicycles and small appliances. The café now measures success not only by the number of objects repaired, but also by the skills that residents take away.';

export const assessmentFormBItems: readonly AssessmentItem[] = [
	formBItem({
		id: 'listen-lee-clinic-time-b',
		area: 'listening',
		taskType: 'short_audio_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'listening', cambridge_cept: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen to a short spoken message and choose the correct detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'The caller says the new appointment time is ten forty on Tuesday.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'At 10:14.' },
			{ id: 'b', text: 'At 10:40.' },
			{ id: 'c', text: 'At 11:40.' },
			{ id: 'd', text: 'At 11:04.' }
		],
		serverOnlyAudioScript:
			'Hello Lee. The clinic needs to move your appointment to Tuesday at ten forty in the morning.',
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'Listen to the message. What time is Lee’s new appointment?',
		reviewNotes:
			'Original beginner detail item; the four times are phonologically distinct and only one is stated.'
	}),
	formBItem({
		id: 'listen-nora-package-main-idea-b',
		area: 'listening',
		taskType: 'short_audio_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'listening', cambridge_cept: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen and choose the main idea.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation: 'Nora is explaining when and where she will collect a package.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'Nora will collect a package after class.' },
			{ id: 'b', text: 'Nora will mail her class assignment.' },
			{ id: 'c', text: 'Nora will work at the front desk.' },
			{ id: 'd', text: 'Nora will collect an assignment after class.' }
		],
		serverOnlyAudioScript:
			'My package is waiting at the front desk until six, so I will pick it up after class.',
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'What is Nora mainly talking about?',
		reviewNotes:
			'Original everyday main-idea item with one action that integrates the place, object, and time.'
	}),
	formBItem({
		id: 'listen-airport-train-track-b',
		area: 'listening',
		taskType: 'short_audio_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'listening', cambridge_cept: 'listening' },
		answerMode: 'choice',
		prompt: 'Listen to an announcement and choose the correct detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail'],
		explanation: 'The announcement directs airport-train passengers to track three.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'Track 1.' },
			{ id: 'b', text: 'Track 2.' },
			{ id: 'c', text: 'Track 3.' },
			{ id: 'd', text: 'Track 4.' }
		],
		serverOnlyAudioScript:
			'Attention passengers. The next train to the airport will depart from track three.',
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'Which track will the airport train leave from?',
		reviewNotes: 'Original transit announcement testing one explicit number detail.'
	}),
	formBItem({
		id: 'read-mateo-course-change-b',
		area: 'reading',
		taskType: 'short_passage_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'reading_skills', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'Mateo registered for an evening course, but his work schedule changed. He moved to the Saturday class instead.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation:
			'Mateo changed classes because his new work schedule conflicted with the evening course.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'The evening course was full.' },
			{ id: 'b', text: 'He wanted a different teacher.' },
			{ id: 'c', text: 'His work schedule changed.' },
			{ id: 'd', text: 'The Saturday class was shorter.' }
		],
		instructions: 'Why did Mateo move to the Saturday class?',
		reviewNotes: 'Original short passage with one directly stated reason and parallel distractors.'
	}),
	formBItem({
		id: 'read-priya-center-main-idea-b',
		area: 'reading',
		taskType: 'short_passage_comprehension',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'reading_skills', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'Priya walked to the recreation center on Thursday. A notice on the door said the building was closed for repairs and would reopen Saturday.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation:
			'The passage is mainly about Priya finding the recreation center closed for repairs.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'Priya works at the recreation center.' },
			{ id: 'b', text: 'The center was closed when Priya arrived.' },
			{ id: 'c', text: 'Priya repaired the building on Saturday.' },
			{ id: 'd', text: 'Priya went to the center to make repairs.' }
		],
		instructions: 'What is the passage mainly about?',
		reviewNotes: 'Original main-idea passage that requires no information outside the text.'
	}),
	formBItem({
		id: 'read-application-required-vocabulary-b',
		area: 'reading',
		taskType: 'vocabulary_in_passage',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'reading_skills', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'A photo is optional, but proof of address is required with every application.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation:
			'The contrast with “optional” shows that “required” means necessary or must be included.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'must be included' },
			{ id: 'b', text: 'may be added later' },
			{ id: 'c', text: 'costs extra money' },
			{ id: 'd', text: 'is recommended but optional' }
		],
		instructions: 'What does “required” mean in this notice?',
		reviewNotes: 'Original context-vocabulary item with an explicit optional/required contrast.'
	}),
	formBItem({
		id: 'grammar-simple-present-watches-b',
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'language_use', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'He ____ the news every evening.',
		primaryScoredSignal: 'subject_verb_agreement',
		errorSignalTags: ['verb_form', 'subject_verb_agreement'],
		explanation: 'Use “watches” with “he” in the simple present tense.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'watch' },
			{ id: 'b', text: 'watches' },
			{ id: 'c', text: 'watching' },
			{ id: 'd', text: 'watchs' }
		],
		instructions: 'Choose the best word to complete the sentence.',
		reviewNotes: 'Original third-person singular item using a regular daily routine.'
	}),
	formBItem({
		id: 'grammar-article-hour-b',
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'language_use', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'The trip takes about ____ hour by bus.',
		primaryScoredSignal: 'article_determiner',
		errorSignalTags: ['article_determiner'],
		explanation: 'Use “an” before the vowel sound at the beginning of “hour.”',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'a' },
			{ id: 'b', text: 'some' },
			{ id: 'c', text: 'an' },
			{ id: 'd', text: 'many' }
		],
		instructions: 'Choose the best word to complete the sentence.',
		reviewNotes: 'Original article item that tests sound rather than spelling.'
	}),
	formBItem({
		id: 'grammar-preposition-july-b',
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'language_use', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'The training program begins ____ July.',
		primaryScoredSignal: 'preposition',
		errorSignalTags: ['preposition'],
		explanation: 'Use “in” with a month.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'in' },
			{ id: 'b', text: 'on' },
			{ id: 'c', text: 'at' },
			{ id: 'd', text: 'between' }
		],
		instructions: 'Choose the best word to complete the sentence.',
		reviewNotes: 'Original time-preposition item with an unambiguous month expression.'
	}),
	formBItem({
		id: 'vocab-rescheduled-interview-b',
		area: 'vocabulary',
		taskType: 'word_in_context',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'sentence_meaning', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'The manager rescheduled my interview from Monday to Thursday.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'collocation'],
		explanation:
			'The change from Monday to Thursday shows that “rescheduled” means moved to a different time.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'shortened' },
			{ id: 'b', text: 'moved to a different time' },
			{ id: 'c', text: 'forgotten' },
			{ id: 'd', text: 'cancelled permanently' }
		],
		instructions: 'What does “rescheduled” mean in this sentence?',
		reviewNotes: 'Original context item with the old and new days supplying the meaning clue.'
	}),
	formBItem({
		id: 'vocab-take-break-collocation-b',
		area: 'vocabulary',
		taskType: 'natural_word_pair',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'sentence_meaning', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'We can ____ a short break after this exercise.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'English normally uses the phrase “take a break.”',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'take' },
			{ id: 'b', text: 'make' },
			{ id: 'c', text: 'build' },
			{ id: 'd', text: 'put' }
		],
		instructions: 'Choose the natural word to complete the sentence.',
		reviewNotes: 'Original high-frequency collocation with grammatical parallel distractors.'
	}),
	formBItem({
		id: 'vocab-noisy-cafe-b',
		area: 'vocabulary',
		taskType: 'word_in_context',
		difficulty: 'foundation',
		profile: 'shared',
		profileSections: { accuplacer_esl: 'sentence_meaning', cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'The café was noisy, so we could not hear each other clearly.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation: 'Not being able to hear shows that “noisy” means full of loud sounds.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'almost empty' },
			{ id: 'b', text: 'very comfortable' },
			{ id: 'c', text: 'full of loud sounds' },
			{ id: 'd', text: 'serving fresh food' }
		],
		instructions: 'What does “noisy” mean in this sentence?',
		reviewNotes: 'Original context-vocabulary item with a direct consequence clue.'
	}),
	formBItem({
		id: 'accu-listen-registration-room-b',
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
			'Students who need schedule help must go to room 312 after checking in downstairs.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'Wait outside the auditorium.' },
			{ id: 'b', text: 'Email the registration office.' },
			{ id: 'c', text: 'Return on Friday morning.' },
			{ id: 'd', text: 'Go to room 312.' }
		],
		serverOnlyAudioScript:
			'Today’s registration help desk has moved from the student center auditorium to the administration building. First, check in at the table on the ground floor. If you only need to collect your identification card, stay there. If you need help changing your class schedule, take the elevator to room three twelve. The desk will close at four thirty this afternoon.',
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'Where should students go for help changing their class schedule?',
		reviewNotes: 'Original ACCUPLACER-style connected announcement with one routed-action detail.'
	}),
	formBItem({
		id: 'accu-listen-reusable-containers-purpose-b',
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
			'The lecture explains that reusable-container programs work only when convenience and repeated use are designed together.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'To prove that disposable containers are always less expensive.' },
			{ id: 'b', text: 'To describe how one factory manufactures glass containers.' },
			{ id: 'c', text: 'To explain what makes reusable-container programs effective.' },
			{ id: 'd', text: 'To argue that customers should wash all containers at home.' }
		],
		serverOnlyAudioScript:
			'Reusable food containers can reduce waste, but only if people actually return and use them many times. Some early programs focused on making very durable containers, yet customers found the return locations inconvenient. Newer programs place return boxes near transit stops and use small deposits that customers receive back immediately. Those changes increase return rates. The environmental benefit therefore depends not only on the material of the container, but also on a system that makes repeated use easy.',
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'What is the main purpose of the lecture?',
		reviewNotes:
			'Original lecture whose keyed purpose integrates the evidence and final conclusion.'
	}),
	formBItem({
		id: 'accu-read-equipment-checkout-b',
		area: 'reading',
		taskType: 'reading_skills_literal_comprehension',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'reading_skills' },
		answerMode: 'choice',
		prompt:
			'Students may borrow cameras from the media center for three days. Reservations made online are held until noon on the pickup day. After noon, unclaimed equipment becomes available to other students. Borrowers who need an extension must ask before the original return time; extensions cannot be added after an item is overdue.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'An extension must be requested before the original return time.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'After the camera becomes overdue.' },
			{ id: 'b', text: 'Before the original return time.' },
			{ id: 'c', text: 'Only when making the reservation.' },
			{ id: 'd', text: 'At noon on the pickup day.' }
		],
		instructions: 'When must a borrower request an extension?',
		reviewNotes: 'Original practical passage with one explicit policy condition.'
	}),
	formBItem({
		id: 'accu-read-office-hours-inference-b',
		area: 'reading',
		taskType: 'reading_skills_inference',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'reading_skills' },
		answerMode: 'choice',
		prompt:
			'A mathematics instructor used to offer office hours only at midday. Few students attended, although course surveys showed that many wanted extra help. This term, the instructor offers one online session in the evening and one shorter session before the morning lecture. Attendance has increased, especially among students with jobs. Exam results have also improved slightly, so the department is asking other instructors to test flexible hours.',
		primaryScoredSignal: 'inference',
		errorSignalTags: ['inference', 'detail'],
		explanation:
			'More flexible times made help accessible to students who could not attend at midday.',
		answerKey: ['a'],
		choices: [
			{
				id: 'a',
				text: 'Offering help at varied times can reach students with different schedules.'
			},
			{
				id: 'b',
				text: 'Online sessions always produce higher exam scores than in-person sessions.'
			},
			{ id: 'c', text: 'Most students stopped attending the morning lecture.' },
			{ id: 'd', text: 'The department will eliminate all midday office hours.' }
		],
		instructions: 'What conclusion is best supported by the passage?',
		reviewNotes:
			'Original cause-and-effect inference without claiming more than the passage supports.'
	}),
	formBItem({
		id: 'accu-language-combine-contrast-b',
		area: 'grammar_usage',
		taskType: 'language_use_sentence_combining',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'language_use' },
		answerMode: 'choice',
		prompt: 'The route is longer. It is usually faster during rush hour.',
		primaryScoredSignal: 'sentence_control',
		errorSignalTags: ['sentence_control', 'verb_form'],
		explanation:
			'“Although” correctly joins the unexpected contrast without a fragment or duplicated connector.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'The route is longer, because usually faster during rush hour.' },
			{ id: 'b', text: 'Although the route is longer, but it is usually faster during rush hour.' },
			{ id: 'c', text: 'Although the route is longer, it is usually faster during rush hour.' },
			{ id: 'd', text: 'The route being longer, it usually faster during rush hour.' }
		],
		instructions:
			'Choose the sentence that best combines the two ideas without changing their meaning.',
		reviewNotes: 'Original Language Use combining task with one grammatical contrast relation.'
	}),
	formBItem({
		id: 'accu-language-each-agreement-b',
		area: 'grammar_usage',
		taskType: 'language_use_fill_in_blank',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'language_use' },
		answerMode: 'choice',
		prompt: 'Each of the reports ____ a summary of the research findings.',
		primaryScoredSignal: 'subject_verb_agreement',
		errorSignalTags: ['subject_verb_agreement', 'verb_form'],
		explanation: 'The head word “each” is singular, so “includes” is correct.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'include' },
			{ id: 'b', text: 'includes' },
			{ id: 'c', text: 'including' },
			{ id: 'd', text: 'have included' }
		],
		instructions: 'Choose the option that makes the sentence grammatically correct.',
		reviewNotes:
			'Original higher-level agreement item with a singular quantifier and plural interruptor.'
	}),
	formBItem({
		id: 'accu-meaning-carry-out-b',
		area: 'vocabulary',
		taskType: 'sentence_meaning_fill_in_blank',
		difficulty: 'intermediate',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'sentence_meaning' },
		answerMode: 'choice',
		prompt: 'The research team will carry out the interviews during the first week of August.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'In this context, “carry out” means perform or conduct the interviews.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'cancel' },
			{ id: 'b', text: 'publish' },
			{ id: 'c', text: 'shorten' },
			{ id: 'd', text: 'perform' }
		],
		instructions: 'What does “carry out” mean in this sentence?',
		reviewNotes: 'Original Sentence Meaning item testing a common academic two-word verb.'
	}),
	formBItem({
		id: 'accu-meaning-despite-delay-b',
		area: 'vocabulary',
		taskType: 'sentence_meaning_paraphrase',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'sentence_meaning' },
		answerMode: 'choice',
		prompt:
			'Despite the delayed shipment, the laboratory completed the project on schedule by borrowing equipment from another department.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'main_idea'],
		explanation:
			'The project finished on time because borrowed equipment offset the shipment delay.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'The laboratory postponed the project until its shipment arrived.' },
			{ id: 'b', text: 'Borrowed equipment helped the laboratory finish on time.' },
			{ id: 'c', text: 'Another department caused the laboratory’s shipment to be delayed.' },
			{ id: 'd', text: 'The laboratory finished early and returned the unopened shipment.' }
		],
		instructions: 'Which sentence has the closest meaning?',
		reviewNotes:
			'Original paraphrase requiring the learner to preserve concession, cause, and outcome.'
	}),
	formBItem({
		id: 'cept-listen-lab-change-b',
		area: 'listening',
		taskType: 'cept_extended_listening_detail',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'listening' },
		stimulusGroupId: 'cept-b-part-time-study',
		stimulusOrder: 1,
		answerMode: 'choice',
		prompt: 'Listen to the extended report and answer the first question.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation:
			'Interviews identified changing work schedules as the obstacle to fixed weekly deadlines.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'Changing work schedules.' },
			{ id: 'b', text: 'Unreliable computers.' },
			{ id: 'c', text: 'Assignments that were too short.' }
		],
		serverOnlyAudioScript: ceptFormBListeningStimulus,
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'What problem did interviews identify for many part-time students?',
		reviewNotes:
			'First question in an original two-question CEPT extended-listening set; tests an ordered supporting detail.'
	}),
	formBItem({
		id: 'cept-listen-part-time-study-b',
		area: 'listening',
		taskType: 'cept_extended_listening',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'listening' },
		stimulusGroupId: 'cept-b-part-time-study',
		stimulusOrder: 2,
		answerMode: 'choice',
		prompt: 'Listen to an extended report and identify its main conclusion.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation:
			'The report concludes that flexible pacing and early adviser contact supported persistence among part-time students.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'Part-time students completed courses only when assignments were shorter.' },
			{ id: 'b', text: 'Advisers recommended that all students reduce their work hours.' },
			{ id: 'c', text: 'Flexible pacing and timely support helped more students continue.' }
		],
		serverOnlyAudioScript: ceptFormBListeningStimulus,
		serverOnlyAudioMetadata: audioMetadata,
		instructions: 'What is the report’s main conclusion?',
		reviewNotes:
			'Original CEPT extended listening with a revised hypothesis and evidence-based conclusion.'
	}),
	formBItem({
		id: 'cept-read-select-workshop-memo-b',
		area: 'reading',
		taskType: 'cept_read_and_select',
		difficulty: 'foundation',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'MEMO: Room 214 is unavailable next Monday, so the job-search workshop will meet in Room 118 at the usual time. Tuesday workshops are not affected.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation:
			'Only Monday’s workshop changes room; its time and the Tuesday schedule stay the same.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'Monday’s workshop will meet in a different room at the usual time.' },
			{ id: 'b', text: 'All workshops next week have moved to Room 118.' },
			{ id: 'c', text: 'The Monday workshop has been moved to Tuesday.' }
		],
		instructions: 'Choose the sentence that most closely matches the meaning of the memo.',
		reviewNotes:
			'Original CEPT read-and-select memo with three sentence alternatives and one complete meaning match.'
	}),
	formBItem({
		id: 'cept-read-north-desk-b',
		area: 'reading',
		taskType: 'cept_extended_reading_detail',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		stimulusGroupId: 'cept-b-repair-cafe',
		stimulusOrder: 1,
		answerMode: 'choice',
		prompt: ceptFormBReadingStimulus,
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation:
			'The volunteers changed the format so visitors worked beside a repairer and learned during the repair.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'They asked visitors to return on a different day.' },
			{ id: 'b', text: 'They invited visitors to work beside a repairer.' },
			{ id: 'c', text: 'They accepted only bicycles and small appliances.' },
			{ id: 'd', text: 'They stopped trying to fix household objects.' }
		],
		instructions: 'How did volunteers respond when visitors wanted to watch and learn?',
		reviewNotes:
			'First question in an original three-question CEPT extended-reading set; tests an ordered supporting detail.'
	}),
	formBItem({
		id: 'cept-read-repair-cafe-b',
		area: 'reading',
		taskType: 'cept_extended_reading',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		stimulusGroupId: 'cept-b-repair-cafe',
		stimulusOrder: 2,
		answerMode: 'choice',
		prompt: ceptFormBReadingStimulus,
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail', 'vocabulary_in_context'],
		explanation:
			'The project evolved from a repair service into a place where residents also build practical skills.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'The café stopped accepting objects that volunteers could not fix.' },
			{ id: 'b', text: 'Residents preferred leaving their objects and returning later.' },
			{ id: 'c', text: 'The organizers replaced repairs with bicycle sales.' },
			{ id: 'd', text: 'The café expanded its goal from fixing objects to teaching skills.' }
		],
		instructions: 'What is the main idea of the passage?',
		reviewNotes:
			'Original extended-reading passage whose answer integrates the project’s change and outcome.'
	}),
	formBItem({
		id: 'cept-extended-gradually-context-b',
		area: 'vocabulary',
		taskType: 'cept_extended_reading_vocabulary',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		stimulusGroupId: 'cept-b-repair-cafe',
		stimulusOrder: 3,
		answerMode: 'choice',
		prompt: ceptFormBReadingStimulus,
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation:
			'The workshops teach people how to keep bicycles and appliances in good working condition, so “maintaining” means caring for something so it continues to work.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'using only once' },
			{ id: 'b', text: 'selling for a profit' },
			{ id: 'c', text: 'keeping in good working condition' },
			{ id: 'd', text: 'replacing with something new' }
		],
		instructions:
			'What does “maintaining” most nearly mean in the sentence about the added workshops?',
		reviewNotes:
			'Third question in the alternate CEPT extended-reading series; tests vocabulary from the shared passage.'
	}),
	formBItem({
		id: 'cept-gap-had-left-b',
		area: 'grammar_usage',
		taskType: 'cept_gapped_sentence',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt: 'When I reached the station, the last bus ____ already _____.',
		primaryScoredSignal: 'verb_form',
		errorSignalTags: ['verb_form'],
		explanation:
			'The bus left before another past event, so the past perfect “had already left” is correct.',
		answerKey: ['d'],
		choices: [
			{ id: 'a', text: 'has / left' },
			{ id: 'b', text: 'was / leaving' },
			{ id: 'c', text: 'did / leave' },
			{ id: 'd', text: 'had / left' }
		],
		instructions: 'Choose the correct option for the gaps.',
		reviewNotes: 'Original four-option CEPT gapped sentence with clear event sequencing.'
	}),
	formBItem({
		id: 'cept-open-gap-responsible-for-b',
		area: 'grammar_usage',
		taskType: 'cept_open_gap_fill',
		difficulty: 'challenge',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'short_text',
		prompt:
			'Team leaders are responsible ____ checking that every form is complete. Only one word is missing.',
		primaryScoredSignal: 'preposition',
		errorSignalTags: ['preposition', 'collocation'],
		explanation: 'The fixed pattern is “be responsible for” an action.',
		answerKey: ['for'],
		instructions: 'Type the one missing word.',
		reviewNotes: 'Original single-word CEPT open gap with one exact normalized answer.'
	}),
	formBItem({
		id: 'cept-mcq-gap-draw-conclusion-b',
		area: 'vocabulary',
		taskType: 'cept_multiple_choice_gap_fill',
		difficulty: 'intermediate',
		profile: 'cambridge_cept',
		profileSections: { cambridge_cept: 'reading' },
		answerMode: 'choice',
		prompt:
			'The sample was too small for the researchers to ____ a firm conclusion from the results.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'English commonly uses the collocation “draw a conclusion.”',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'pull' },
			{ id: 'b', text: 'draw' },
			{ id: 'c', text: 'paint' },
			{ id: 'd', text: 'write' }
		],
		instructions: 'Choose the correct word for the gap.',
		reviewNotes: 'Original CEPT lexical gap testing a common academic collocation.'
	}),
	formBItem({
		id: 'accu-writeplacer-online-opportunity-b',
		area: 'writing',
		taskType: 'writeplacer_esl_readiness_essay',
		difficulty: 'challenge',
		profile: 'accuplacer_esl',
		profileSections: { accuplacer_esl: 'writeplacer_esl' },
		prompt:
			'Some schools and workplaces offer both in-person and online options. Write an essay explaining which option should be expanded in a place you know. State your position, give reasons, and support it with specific examples.',
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
			'The essay should state a clear position, develop relevant reasons and examples, and maintain understandable organization and language control.',
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
		instructions:
			'Write 300–600 words. State your position, explain your reasons, and support them with specific examples. This receives only an internal 0–3 readiness review, not an official WritePlacer ESL 1–6 score.',
		reviewNotes:
			'Original alternate WritePlacer-readiness prompt with the same bounded internal rubric.'
	}),
	formBItem({
		id: 'write-plan-improved-b',
		area: 'writing',
		taskType: 'placement_readiness_paragraph',
		prompt:
			'Write 120–180 words about a plan that did not work at first. Explain the original plan, what you changed, and the final result.',
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
			'score_2: addresses the original plan, change, and result with generally clear organization; recurring errors are present but meaning stays understandable',
			'score_3: writes 120–180 relevant words; fully develops all three parts in a clear sequence; word choice and sentence control are mostly accurate',
			'task_completion: writes 120–180 relevant words and addresses the original plan, change, and result',
			'organization: sequences the response with a clear beginning, development, and outcome',
			'clarity: ideas are understandable without guessing',
			'grammar_control: reviews tense, agreement, articles, plurals, and sentence boundaries',
			'vocabulary: uses accurate words and natural combinations for the chosen context'
		],
		instructions:
			'Write 120–180 words. Explain the original plan, what you changed, and the final result. Spend a minute planning before you write.',
		reviewNotes:
			'Original alternate connected-writing task with equivalent length and evidence expectations.'
	}),
	formBItem({
		id: 'speak-helpful-experience-b',
		area: 'speaking',
		taskType: 'recorded_short_answer',
		prompt:
			'Describe a time when someone taught you how to do something. What did you learn, and how did it help you?',
		errorSignalTags: ['task_completion', 'clarity', 'fluency', 'verb_form', 'sentence_control'],
		explanation:
			'The response should identify the skill, describe the help, and remain understandable in a short connected answer.',
		rubric: [
			'task_completion: identifies what was learned and explains how it helped',
			'clarity: meaning is understandable',
			'fluency: answer is not blocked by long pauses',
			'grammar_control: basic past-tense and sentence control are usable'
		],
		instructions:
			'Record a short answer: Describe a time when someone taught you how to do something. What did you learn, and how did it help you?',
		reviewNotes: 'Original safe speaking prompt with two explicit content requirements.'
	})
];
