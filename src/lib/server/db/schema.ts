import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';
import type {
	PracticeFeedback,
	PracticeMetadata,
	PracticeProblem
} from '$lib/server/adaptive-practice';
import type { SkillProfile, StudyPlan, DiagnosisMetadata } from '$lib/server/assessment-diagnosis';
import type { AssessmentArea } from '$lib/server/assessment-items';

export type AssessmentAttemptStatus = 'in_progress' | 'completed';
export type PracticeAttemptStatus = 'presented' | 'answered';

export type AssessmentIntake = {
	goal: string;
	selfRatings: {
		speaking: 1 | 2 | 3 | 4 | 5;
		reading: 1 | 2 | 3 | 4 | 5;
		writing: 1 | 2 | 3 | 4 | 5;
	};
	timeZone: string;
};

export type AttemptSelectedItem = {
	id: string;
	version: number;
	area: AssessmentArea;
};

export type AttemptResponse =
	| {
			area: Exclude<AssessmentArea, 'writing' | 'speaking'>;
			itemId: string;
			itemVersion: number;
			kind: 'objective';
			answer: string;
	  }
	| {
			area: 'writing';
			itemId: string;
			itemVersion: number;
			kind: 'writing_text';
			answer: string;
	  }
	| {
			area: 'speaking';
			itemId: string;
			itemVersion: number;
			kind: 'speaking_metadata';
			metadata: {
				representedBy: 'temporary_metadata';
				responseSeconds: number;
				transcript?: string;
				transcriptSource?: 'workers_ai_asr' | 'submitted';
				transcriptionMetadata?: {
					provider: 'workers-ai';
					modelId: string;
					promptVersion: 'assessment-asr-v1';
					schemaVersion: 1;
					generatedAt: string;
				};
			};
	  };

export const assessmentAttempt = sqliteTable(
	'assessment_attempt',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		learnerUserId: text('learner_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: text('status').$type<AssessmentAttemptStatus>().notNull().default('in_progress'),
		definitionVersion: integer('definition_version').notNull().default(1),
		intakeJson: text('intake_json', { mode: 'json' }).$type<AssessmentIntake>().notNull(),
		selectedItemsJson: text('selected_items_json', { mode: 'json' })
			.$type<AttemptSelectedItem[]>()
			.notNull(),
		responsesJson: text('responses_json', { mode: 'json' }).$type<AttemptResponse[]>().notNull(),
		skillProfileJson: text('skill_profile_json', { mode: 'json' }).$type<SkillProfile>(),
		studyPlanJson: text('study_plan_json', { mode: 'json' }).$type<StudyPlan>(),
		diagnosisMetadataJson: text('diagnosis_metadata_json', {
			mode: 'json'
		}).$type<DiagnosisMetadata>(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		completedAt: integer('completed_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('assessment_attempt_learner_created_idx').on(table.learnerUserId, table.createdAt),
		uniqueIndex('assessment_attempt_one_in_progress_idx')
			.on(table.learnerUserId)
			.where(sql`${table.status} = 'in_progress'`)
	]
);

export const practiceAttempt = sqliteTable(
	'practice_attempt',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		learnerUserId: text('learner_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		assessmentAttemptId: text('assessment_attempt_id')
			.notNull()
			.references(() => assessmentAttempt.id, { onDelete: 'cascade' }),
		status: text('status').$type<PracticeAttemptStatus>().notNull().default('answered'),
		sessionId: text('session_id').notNull().default(''),
		sequence: integer('sequence').notNull().default(1),
		practiceProblemJson: text('practice_problem_json', { mode: 'json' })
			.$type<PracticeProblem>()
			.notNull(),
		answer: text('answer'),
		feedbackJson: text('feedback_json', { mode: 'json' }).$type<PracticeFeedback>(),
		metadataJson: text('metadata_json', { mode: 'json' }).$type<PracticeMetadata>().notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		answeredAt: integer('answered_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('practice_attempt_learner_created_idx').on(table.learnerUserId, table.createdAt),
		uniqueIndex('practice_attempt_one_presented_idx')
			.on(table.learnerUserId)
			.where(sql`${table.status} = 'presented'`),
		uniqueIndex('practice_attempt_session_sequence_idx')
			.on(table.sessionId, table.sequence)
			.where(sql`${table.sessionId} <> ''`)
	]
);

export * from './auth.schema';
