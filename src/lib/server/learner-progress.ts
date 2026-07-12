import { desc, eq } from 'drizzle-orm';
import {
	buildPracticeReview,
	getPracticeReviewSchedule,
	getReassessmentProgress,
	practiceModalityMatchesTarget,
	practiceTargetKey,
	validatePracticeFeedback,
	validatePracticeMetadata,
	validatePracticeProblem
} from './adaptive-practice';
import {
	validateDiagnosisMetadata,
	validateSkillProfile,
	validateStudyPlan,
	type SkillProfile
} from './assessment-diagnosis';
import {
	getAssessmentItemVersion,
	type AssessmentArea,
	type ErrorSignal
} from './assessment-items';
import { assessmentIntakeSchema, nextAssessmentFormId } from './assessment-attempts';
import type { Db } from './db';
import { assessmentAttempt, practiceAttempt, user } from './db/schema';

const areas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
] as const satisfies readonly AssessmentArea[];

type AssessmentRow = typeof assessmentAttempt.$inferSelect;
type PracticeRow = typeof practiceAttempt.$inferSelect;

const parseAssessment = (row: AssessmentRow) => ({
	...row,
	intake: assessmentIntakeSchema.parse(row.intakeJson),
	skillProfile: row.skillProfileJson ? validateSkillProfile(row.skillProfileJson) : null,
	studyPlan: row.studyPlanJson ? validateStudyPlan(row.studyPlanJson) : null,
	diagnosisMetadata: row.diagnosisMetadataJson
		? validateDiagnosisMetadata(row.diagnosisMetadataJson)
		: null
});

const parsePractice = (row: PracticeRow) => ({
	...row,
	problem: validatePracticeProblem(row.practiceProblemJson),
	feedback: row.feedbackJson ? validatePracticeFeedback(row.feedbackJson) : null,
	metadata: validatePracticeMetadata(row.metadataJson)
});

const feedbackScore = (
	feedback: ReturnType<typeof validatePracticeFeedback> | null,
	problem?: ReturnType<typeof validatePracticeProblem>,
	metadata?: ReturnType<typeof validatePracticeMetadata>
) => {
	if (!feedback?.scored) return null;
	if (problem && !practiceModalityMatchesTarget(problem)) return null;
	if (
		problem?.targetArea === 'listening' &&
		(problem.kind !== 'listening_choice' || !metadata?.audioDeliveredAt)
	) {
		return null;
	}
	return feedback.kind === 'objective' ? feedback.correct : feedback.meetsTarget;
};

const weekKey = (date: Date, timeZone: string) => {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(date);
	} catch {
		parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'UTC',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(date);
	}
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	const local = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
	const offset = (local.getUTCDay() + 6) % 7;
	local.setUTCDate(local.getUTCDate() - offset);
	return local.toISOString().slice(0, 10);
};

export function getWeeklySessionTarget({
	now,
	testDate,
	remainingResponses,
	requiredSessions,
	completedSessions
}: {
	now: Date;
	testDate?: string;
	remainingResponses: number;
	requiredSessions: number;
	completedSessions: number;
}) {
	const testDateTime = testDate ? Date.parse(`${testDate}T23:59:59Z`) : Number.NaN;
	const weeksUntilTest =
		Number.isFinite(testDateTime) && testDateTime >= now.getTime()
			? Math.max(1, Math.ceil((testDateTime - now.getTime()) / (7 * 24 * 60 * 60 * 1000)))
			: null;
	const sessionsNeeded = Math.max(
		1,
		Math.ceil(remainingResponses / 5),
		requiredSessions - completedSessions
	);
	return {
		target: weeksUntilTest
			? Math.min(5, Math.max(1, Math.ceil(sessionsNeeded / weeksUntilTest)))
			: 5,
		basedOnTestDate: weeksUntilTest !== null
	};
}

const buildSessions = (rows: ReturnType<typeof parsePractice>[]) => {
	const groups = new Map<string, ReturnType<typeof parsePractice>[]>();
	for (const row of rows) {
		const sessionId = row.sessionId || row.id;
		const group = groups.get(sessionId) ?? [];
		group.push(row);
		groups.set(sessionId, group);
	}
	return [...groups.entries()]
		.map(([sessionId, sessionRows]) => {
			const ordered = sessionRows.sort((left, right) => left.sequence - right.sequence);
			const answered = ordered.filter((row) => row.status === 'answered');
			const scores = answered
				.map((row) => feedbackScore(row.feedback, row.problem, row.metadata))
				.filter((score) => score !== null);
			const completed = ordered.length === 5 && answered.length === 5;
			return {
				sessionId,
				status: completed ? ('completed' as const) : ('in_progress' as const),
				answeredCount: answered.length,
				scoredCount: scores.length,
				correctCount: scores.filter(Boolean).length,
				targetSignals: [...new Set(ordered.map((row) => row.problem.targetSignal))],
				startedAt: ordered[0]?.createdAt ?? new Date(0),
				completedAt: completed
					? answered.reduce(
							(latest, row) =>
								row.answeredAt && row.answeredAt > latest ? row.answeredAt : latest,
							answered[0]?.answeredAt ?? answered[0]?.createdAt ?? new Date(0)
						)
					: null,
				results: answered.map((row) => ({
					sequence: row.sequence,
					targetArea: row.problem.targetArea,
					targetSignal: row.problem.targetSignal,
					difficulty: row.problem.difficulty,
					...(row.problem.kind === 'listening_choice'
						? {
								audioUrl: `/practice/audio/${row.id}`,
								audioTranscript: row.problem.audioScript
							}
						: {}),
					scored: feedbackScore(row.feedback, row.problem, row.metadata) !== null,
					correct: feedbackScore(row.feedback, row.problem, row.metadata),
					...(row.feedback
						? buildPracticeReview(row.problem, row.answer, row.feedback)
						: {
								prompt: row.problem.prompt,
								learnerAnswer: 'No response was saved.',
								expectedAnswer: 'Feedback unavailable.',
								explanation: 'Feedback unavailable.',
								nextStep: 'Continue with another practice problem.'
							}),
					feedback: row.feedback
				}))
			};
		})
		.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
};

export const summarizeSignalPerformance = (
	entries: readonly { area: AssessmentArea; signal: ErrorSignal; correct: boolean }[]
) => {
	const groups = new Map<
		string,
		{ signal: ErrorSignal; area: AssessmentArea; attempts: number; correct: number }
	>();
	for (const entry of entries) {
		const key = practiceTargetKey(entry.area, entry.signal);
		const current = groups.get(key) ?? {
			signal: entry.signal,
			area: entry.area,
			attempts: 0,
			correct: 0
		};
		current.attempts += 1;
		if (entry.correct) current.correct += 1;
		groups.set(key, current);
	}
	return [...groups.values()]
		.map((entry) => ({ ...entry, accuracy: entry.correct / entry.attempts }))
		.sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts);
};

const signalPerformance = (rows: ReturnType<typeof parsePractice>[]) =>
	summarizeSignalPerformance(
		rows.flatMap((row) => {
			const score = feedbackScore(row.feedback, row.problem, row.metadata);
			return score === null
				? []
				: [{ area: row.problem.targetArea, signal: row.problem.targetSignal, correct: score }];
		})
	);

const assessmentSummary = (attempt: ReturnType<typeof parseAssessment>) => ({
	attemptId: attempt.id,
	status: attempt.status,
	goal: attempt.intake.goal,
	placementTest: attempt.intake.placementTest,
	definitionVersion: attempt.definitionVersion,
	createdAt: attempt.createdAt,
	updatedAt: attempt.updatedAt,
	completedAt: attempt.completedAt,
	skillProfile: attempt.skillProfile,
	studyPlan: attempt.studyPlan,
	diagnosisMetadata: attempt.diagnosisMetadata
});

export async function getLearnerProductData(db: Db, learnerUserId: string, now = new Date()) {
	const [rawAssessments, rawPractice] = await Promise.all([
		db
			.select()
			.from(assessmentAttempt)
			.where(eq(assessmentAttempt.learnerUserId, learnerUserId))
			.orderBy(desc(assessmentAttempt.createdAt))
			.limit(50),
		db
			.select()
			.from(practiceAttempt)
			.where(eq(practiceAttempt.learnerUserId, learnerUserId))
			.orderBy(desc(practiceAttempt.createdAt))
			.limit(500)
	]);
	const assessments = rawAssessments.map(parseAssessment);
	const practice = rawPractice.map(parsePractice);
	const completedAssessments = assessments.filter(
		(attempt) => attempt.status === 'completed' && attempt.skillProfile && attempt.studyPlan
	);
	const latest = completedAssessments[0];
	const reassessmentAvailable = latest
		? (() => {
				try {
					return (
						nextAssessmentFormId(
							latest.intake.placementTest,
							assessments
								.filter((attempt) => attempt.status === 'completed')
								.map((attempt) => attempt.selectedItemsJson)
						) !== null
					);
				} catch {
					return false;
				}
			})()
		: true;
	const latestPractice = latest
		? practice.filter((attempt) => attempt.assessmentAttemptId === latest.id)
		: [];
	const sessions = buildSessions(practice);
	const latestSessions = buildSessions(latestPractice);
	const scoredHistory = latestPractice.flatMap((row) => {
		const score = feedbackScore(row.feedback, row.problem, row.metadata);
		return score === null
			? []
			: [
					{
						practiceId: row.id,
						sessionId: row.sessionId,
						targetArea: row.problem.targetArea,
						targetSignal: row.problem.targetSignal,
						difficulty: row.problem.difficulty,
						adaptiveReason: row.problem.adaptiveReason,
						contentId: row.problem.id,
						scored: true,
						correct: score,
						answeredAt: (row.answeredAt ?? row.createdAt).toISOString()
					}
				];
	});
	const targetReviewSchedules = (latest?.studyPlan?.targets ?? []).map((target) => ({
		...target,
		...getPracticeReviewSchedule(scoredHistory, target.area, target.signal, now)
	}));
	const practicedReviewSchedules = targetReviewSchedules.filter((target) => target.attempts > 0);
	const reviewsDue = practicedReviewSchedules.filter((target) => target.due).length;
	const nextReviewAt =
		practicedReviewSchedules
			.flatMap((target) => (target.dueAt && !target.due ? [target.dueAt] : []))
			.sort()[0] ?? null;
	const threshold = latest?.studyPlan?.reassessAfterPracticeCount ?? 20;
	const reassessment = getReassessmentProgress(scoredHistory, threshold, {
		targets: latest?.studyPlan?.targets,
		completedSessions: latestSessions.filter((session) => session.status === 'completed').length
	});
	const timeZone = latest?.intake.timeZone ?? 'UTC';
	const currentWeek = weekKey(now, timeZone);
	const testDate = latest?.intake.placementTest.testDate;
	const weeklySessionGoal = getWeeklySessionTarget({
		now,
		testDate,
		remainingResponses: reassessment.remaining,
		requiredSessions: reassessment.requiredSessions,
		completedSessions: reassessment.completedSessions
	});
	const completedThisWeek = sessions.filter(
		(session) => session.completedAt && weekKey(session.completedAt, timeZone) === currentWeek
	).length;
	const inProgressAssessment = assessments.find((attempt) => attempt.status === 'in_progress');
	const inProgressSession = latestSessions.find((session) => session.status === 'in_progress');
	const primaryAction = inProgressAssessment
		? { href: '/assessment', label: 'Resume Skill Diagnosis' }
		: !latest
			? { href: '/assessment', label: 'Start Skill Diagnosis' }
			: inProgressSession
				? { href: '/practice', label: 'Resume today’s session' }
				: reassessment.recommended && reassessmentAvailable
					? { href: '/assessment?new=1', label: 'Start recommended reassessment' }
					: reviewsDue > 0
						? {
								href: '/practice',
								label: `Review ${reviewsDue} due ${reviewsDue === 1 ? 'skill' : 'skills'}`
							}
						: { href: '/practice', label: 'Start today’s session' };

	return {
		primaryAction,
		weeklyGoal: {
			completed: completedThisWeek,
			target: weeklySessionGoal.target,
			testDate: testDate ?? null,
			basedOnTestDate: weeklySessionGoal.basedOnTestDate
		},
		reviewSchedule: { due: reviewsDue, nextReviewAt },
		latestAssessment: latest ? assessmentSummary(latest) : null,
		assessmentHistory: completedAssessments.map(assessmentSummary),
		currentTargets: latest?.studyPlan?.targets ?? [],
		lastSession: sessions[0] ?? null,
		sessions,
		signalPerformance: signalPerformance(latestPractice),
		reassessment: { ...reassessment, available: reassessmentAvailable }
	};
}

export function bandChanges(history: { skillProfile: SkillProfile | null }[]) {
	const current = history[0]?.skillProfile;
	const previous = history[1]?.skillProfile;
	const assessedAreas = current?.assessedAreas ? new Set(current.assessedAreas) : null;
	return areas
		.filter((area) => !assessedAreas || assessedAreas.has(area))
		.map((area) => ({
			area,
			current: current?.skillBands[area] ?? 'insufficient_evidence',
			previous: previous?.skillBands[area] ?? null,
			changed: Boolean(previous && current?.skillBands[area] !== previous.skillBands[area])
		}));
}

export async function getAdminProductData(db: Db) {
	const [learner] = await db.select().from(user).where(eq(user.role, 'learner')).limit(1);
	if (!learner) return { learner: null, dashboard: null, audit: [] };
	const dashboard = await getLearnerProductData(db, learner.id);
	const attempts = await db
		.select()
		.from(assessmentAttempt)
		.where(eq(assessmentAttempt.learnerUserId, learner.id))
		.orderBy(desc(assessmentAttempt.createdAt))
		.limit(20);
	const audit = attempts.map((raw) => {
		const attempt = parseAssessment(raw);
		return {
			attemptId: attempt.id,
			status: attempt.status,
			createdAt: attempt.createdAt,
			completedAt: attempt.completedAt,
			responses: attempt.responsesJson.map((response) => {
				const item = getAssessmentItemVersion(response.itemId, response.itemVersion);
				return {
					area: response.area,
					itemId: response.itemId,
					itemVersion: response.itemVersion,
					response:
						response.kind === 'objective'
							? (item?.choices?.find((choice) => choice.id === response.answer)?.text ??
								'Historical choice unavailable')
							: response.kind === 'writing_text'
								? response.answer
								: {
										responseSeconds: response.metadata.responseSeconds,
										transcript: response.metadata.transcript ?? null
									}
				};
			}),
			metadata: attempt.diagnosisMetadata
		};
	});
	return {
		learner: { id: learner.id, name: learner.name },
		dashboard,
		audit
	};
}
