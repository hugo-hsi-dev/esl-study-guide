import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';
import type { SkillProfile, StudyPlan, DiagnosisMetadata } from '$lib/server/assessment-diagnosis';
import type { AssessmentArea } from '$lib/server/assessment-items';

export type AssessmentAttemptStatus = 'pending_skill_diagnosis' | 'skill_diagnosed';

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
		status: text('status')
			.$type<AssessmentAttemptStatus>()
			.notNull()
			.default('pending_skill_diagnosis'),
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
			.notNull()
	},
	(table) => [
		index('assessment_attempt_learner_created_idx').on(table.learnerUserId, table.createdAt)
	]
);

export * from './auth.schema';
