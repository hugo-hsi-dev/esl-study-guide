import { desc, eq } from 'drizzle-orm';
import {
	getReassessmentProgress,
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
import { assessmentIntakeSchema } from './assessment-attempts';
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

const feedbackScore = (feedback: ReturnType<typeof validatePracticeFeedback> | null) => {
	if (!feedback?.scored) return null;
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
				.map((row) => feedbackScore(row.feedback))
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
					scored: row.feedback?.scored ?? false,
					correct: feedbackScore(row.feedback),
					feedback: row.feedback
				}))
			};
		})
		.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
};

const signalPerformance = (rows: ReturnType<typeof parsePractice>[]) => {
	const groups = new Map<
		ErrorSignal,
		{ signal: ErrorSignal; area: AssessmentArea; attempts: number; correct: number }
	>();
	for (const row of rows) {
		const score = feedbackScore(row.feedback);
		if (score === null) continue;
		const current = groups.get(row.problem.targetSignal) ?? {
			signal: row.problem.targetSignal,
			area: row.problem.targetArea,
			attempts: 0,
			correct: 0
		};
		current.attempts += 1;
		if (score) current.correct += 1;
		groups.set(current.signal, current);
	}
	return [...groups.values()]
		.map((entry) => ({ ...entry, accuracy: entry.correct / entry.attempts }))
		.sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts);
};

const assessmentSummary = (attempt: ReturnType<typeof parseAssessment>) => ({
	attemptId: attempt.id,
	status: attempt.status,
	goal: attempt.intake.goal,
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
	const latestPractice = latest
		? practice.filter((attempt) => attempt.assessmentAttemptId === latest.id)
		: [];
	const sessions = buildSessions(latestPractice);
	const scoredHistory = latestPractice.flatMap((row) => {
		const score = feedbackScore(row.feedback);
		return score === null
			? []
			: [
					{
						practiceId: row.id,
						targetArea: row.problem.targetArea,
						targetSignal: row.problem.targetSignal,
						difficulty: row.problem.difficulty,
						adaptiveReason: row.problem.adaptiveReason,
						contentId: row.problem.id,
						scored: true,
						correct: score
					}
				];
	});
	const threshold = latest?.studyPlan?.reassessAfterPracticeCount ?? 20;
	const reassessment = getReassessmentProgress(scoredHistory, threshold);
	const timeZone = latest?.intake.timeZone ?? 'UTC';
	const currentWeek = weekKey(now, timeZone);
	const completedThisWeek = sessions.filter(
		(session) => session.completedAt && weekKey(session.completedAt, timeZone) === currentWeek
	).length;
	const inProgressAssessment = assessments.find((attempt) => attempt.status === 'in_progress');
	const inProgressSession = sessions.find((session) => session.status === 'in_progress');
	const primaryAction = inProgressAssessment
		? { href: '/assessment', label: 'Resume Skill Diagnosis' }
		: !latest
			? { href: '/assessment', label: 'Start Skill Diagnosis' }
			: inProgressSession
				? { href: '/practice', label: 'Resume today’s session' }
				: { href: '/practice', label: 'Start today’s session' };

	return {
		primaryAction,
		weeklyGoal: { completed: Math.min(completedThisWeek, 5), target: 5 },
		latestAssessment: latest ? assessmentSummary(latest) : null,
		assessmentHistory: completedAssessments.map(assessmentSummary),
		currentTargets: latest?.studyPlan?.targets ?? [],
		lastSession: sessions[0] ?? null,
		sessions,
		signalPerformance: signalPerformance(latestPractice),
		reassessment
	};
}

export function bandChanges(history: { skillProfile: SkillProfile | null }[]) {
	const current = history[0]?.skillProfile;
	const previous = history[1]?.skillProfile;
	return areas.map((area) => ({
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
