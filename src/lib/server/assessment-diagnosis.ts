import {
	getAssessmentResponseSignals,
	getSeedAssessmentItems,
	type AssessmentArea,
	type ErrorSignal
} from './assessment-items';
import type { AttemptResponse, AttemptSelectedItem } from './db/schema';

export type AssessmentEvidence = {
	taskCount: number;
	status: 'answered_correctly' | 'needs_practice' | 'sample_saved' | 'not_available';
	summary: string;
};

export type SkillProfile = {
	evidence: Record<AssessmentArea, AssessmentEvidence>;
	priorityWeaknesses: { area: AssessmentArea; signal: ErrorSignal; reason: string }[];
	missedAnswerExamples: {
		area: AssessmentArea;
		itemId: string;
		learnerAnswer: string;
		expectedAnswer: string;
		explanation: string;
		errorSignals: ErrorSignal[];
	}[];
	rubricOutputs: {
		writing: { score: null; signals: ErrorSignal[]; feedback: string };
		speaking: { score: null; signals: ErrorSignal[]; feedback: string };
		pronunciation: { score: null; signals: ErrorSignal[]; feedback: string };
	};
};

export type StudyPlan = {
	today: string[];
	thisWeek: string[];
	targetSignals: ErrorSignal[];
};

export type DiagnosisMetadata = {
	schemaVersion: 1;
	provider: 'local' | 'workers-ai';
	model: string;
	modelVersion: '2026-07-08';
	selectedItems: AttemptSelectedItem[];
};

type DiagnosisInput = {
	selectedItems: AttemptSelectedItem[];
	responses: AttemptResponse[];
};

const assessmentAreas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
] as const satisfies readonly AssessmentArea[];

const signalLabel: Record<ErrorSignal, string> = {
	main_idea: 'main ideas',
	detail: 'details',
	vocabulary_in_context: 'vocabulary in context',
	verb_form: 'verb forms',
	subject_verb_agreement: 'subject-verb agreement',
	article_determiner: 'articles',
	plural_countability: 'plural nouns',
	preposition: 'prepositions',
	pronoun_choice: 'pronouns',
	sentence_control: 'sentence control',
	collocation: 'collocations',
	task_completion: 'task completion',
	clarity: 'clarity',
	fluency: 'fluency'
};

const incrementSignals = (
	counts: Map<ErrorSignal, number>,
	areas: Map<ErrorSignal, AssessmentArea>,
	area: AssessmentArea,
	signals: ErrorSignal[]
) => {
	for (const signal of signals) {
		counts.set(signal, (counts.get(signal) ?? 0) + 1);
		if (!areas.has(signal)) areas.set(signal, area);
	}
};

const choiceText = (item: ReturnType<typeof getSeedAssessmentItems>[number], choiceId: string) =>
	item.choices?.find((choice) => choice.id === choiceId)?.text ?? choiceId;

function diagnoseAssessmentAttemptDeterministic({ selectedItems, responses }: DiagnosisInput): {
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	diagnosisMetadata: DiagnosisMetadata;
} {
	const items = new Map(getSeedAssessmentItems().map((item) => [item.id, item]));
	const evidence = {} as Record<AssessmentArea, AssessmentEvidence>;
	const signalCounts = new Map<ErrorSignal, number>();
	const signalAreas = new Map<ErrorSignal, AssessmentArea>();
	const missedAnswerExamples: SkillProfile['missedAnswerExamples'] = [];
	let speakingTranscriptSaved = false;

	for (const response of responses) {
		const item = items.get(response.itemId);
		if (!item) continue;

		if (response.kind === 'objective') {
			const correct = item.answerKey?.includes(response.answer) ?? false;
			evidence[response.area] = {
				taskCount: 1,
				status: correct ? 'answered_correctly' : 'needs_practice',
				summary: correct
					? 'You answered one short question correctly. Try another example later to confirm it.'
					: 'This one response suggests a helpful practice target. More examples are needed before naming a skill level.'
			};

			if (!correct) {
				const signals = getAssessmentResponseSignals(response.itemId, response.answer);
				incrementSignals(signalCounts, signalAreas, response.area, signals);
				missedAnswerExamples.push({
					area: response.area,
					itemId: response.itemId,
					learnerAnswer: choiceText(item, response.answer),
					expectedAnswer: choiceText(item, item.answerKey?.[0] ?? 'n/a'),
					explanation: item.explanation,
					errorSignals: signals
				});
			}
			continue;
		}

		if (response.kind === 'writing_text') {
			evidence.writing = {
				taskCount: 1,
				status: 'sample_saved',
				summary:
					'One writing sample is saved. We need more language evidence before identifying a grammar pattern.'
			};
			continue;
		}

		speakingTranscriptSaved = Boolean(response.metadata.transcript);
		evidence.speaking = {
			taskCount: 1,
			status: 'sample_saved',
			summary:
				'One speaking attempt is logged. Audio is not stored; a transcript may be saved when available. This is not a fluency or pronunciation score.'
		};
	}

	for (const area of assessmentAreas) {
		if (!evidence[area]) {
			evidence[area] = {
				taskCount: 0,
				status: 'not_available',
				summary: 'No response was available for this area.'
			};
		}
	}

	const priorityWeaknesses = [...signalCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([signal]) => ({
			area: signalAreas.get(signal) ?? 'grammar_usage',
			signal,
			reason: `This response suggests starting with ${signalLabel[signal]}. We will use more examples before treating it as a stable need.`
		}));

	const targetSignals = priorityWeaknesses.map((weakness) => weakness.signal);
	const studyPlan: StudyPlan = {
		today: targetSignals.length
			? targetSignals.map(
					(signal) =>
						`Try a short ${signalLabel[signal]} practice set. Your next answers will decide whether to repeat or move on.`
				)
			: ['Start with a short verb-form check-in to collect a little more evidence.'],
		thisWeek: targetSignals.length
			? targetSignals.map(
					(signal) =>
						`Return to ${signalLabel[signal]} for a few new examples before expecting a level estimate.`
				)
			: ['Come back for a few more short examples before expecting a skill-level estimate.'],
		targetSignals
	};

	return {
		skillProfile: {
			evidence,
			priorityWeaknesses,
			missedAnswerExamples,
			rubricOutputs: {
				writing: {
					score: null,
					signals: [],
					feedback:
						'Your writing sample is saved. One short response is not enough to identify grammar patterns reliably.'
				},
				speaking: {
					score: null,
					signals: [],
					feedback: speakingTranscriptSaved
						? 'A transcript of one speaking response is saved. We need more samples before making a language judgement.'
						: 'One speaking attempt is logged. The audio is not stored; a transcript can help us review language patterns.'
				},
				pronunciation: {
					score: null,
					signals: [],
					feedback:
						'Pronunciation is not scored in this first check. It needs dedicated speech evaluation.'
				}
			}
		},
		studyPlan,
		diagnosisMetadata: {
			schemaVersion: 1,
			provider: 'local',
			model: 'evidence-calibrated-diagnosis',
			modelVersion: '2026-07-08',
			selectedItems
		}
	};
}

export async function diagnoseAssessmentAttempt(input: DiagnosisInput): Promise<{
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	diagnosisMetadata: DiagnosisMetadata;
}> {
	return diagnoseAssessmentAttemptDeterministic(input);
}
