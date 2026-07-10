import { env } from 'cloudflare:workers';
import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const testEnv = env as Env & {
	UPGRADE_DB: D1Database;
	TEST_MIGRATIONS: D1Migration[];
};

const insertUser = (id: string, db = testEnv.DB) =>
	db
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, updated_at, role)
		 VALUES (?, ?, ?, 0, 1, 'learner')`
		)
		.bind(id, id, `${id}@example.invalid`)
		.run();

const insertAssessment = (id: string, learnerId: string, status = 'in_progress') =>
	testEnv.DB.prepare(
		`INSERT INTO assessment_attempt
		 (id, learner_user_id, status, definition_version, intake_json, selected_items_json, responses_json)
		 VALUES (?, ?, ?, 2, ?, '[]', '[]')`
	)
		.bind(
			id,
			learnerId,
			status,
			JSON.stringify({
				goal: 'Use English at work',
				selfRatings: { speaking: 3, reading: 3, writing: 3 },
				timeZone: 'UTC'
			})
		)
		.run();

describe('D1 study migrations', () => {
	it('applies a fresh schema with foreign keys and pending-state constraints', async () => {
		expect.assertions(7);
		await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
		await insertUser('learner-1');
		await insertAssessment('assessment-1', 'learner-1');

		await expect(insertAssessment('assessment-2', 'learner-1')).rejects.toThrow();
		await insertAssessment('assessment-complete', 'learner-1', 'completed');
		const problem = JSON.stringify({ id: 'private-problem' });
		const metadata = JSON.stringify({ provider: 'local' });
		await testEnv.DB.prepare(
			`INSERT INTO practice_attempt
			 (id, learner_user_id, assessment_attempt_id, status, session_id, sequence,
			  practice_problem_json, metadata_json)
			 VALUES ('practice-1', 'learner-1', 'assessment-complete', 'presented',
			  'session-1', 1, ?, ?)`
		)
			.bind(problem, metadata)
			.run();

		await expect(
			testEnv.DB.prepare(
				`INSERT INTO practice_attempt
				 (id, learner_user_id, assessment_attempt_id, status, session_id, sequence,
				  practice_problem_json, metadata_json)
				 VALUES ('practice-2', 'learner-1', 'assessment-complete', 'presented',
				  'session-1', 2, ?, ?)`
			)
				.bind(problem, metadata)
				.run()
		).rejects.toThrow();
		await testEnv.DB.prepare(
			`UPDATE practice_attempt SET status = 'answered', answer = '{}', feedback_json = '{}'
			 WHERE id = 'practice-1'`
		).run();
		await testEnv.DB.prepare(
			`INSERT INTO practice_attempt
			 (id, learner_user_id, assessment_attempt_id, status, session_id, sequence,
			  practice_problem_json, metadata_json)
			 VALUES ('practice-2', 'learner-1', 'assessment-complete', 'presented',
			  'session-1', 2, ?, ?)`
		)
			.bind(problem, metadata)
			.run();
		await expect(
			testEnv.DB.prepare(
				`INSERT INTO practice_attempt
				 (id, learner_user_id, assessment_attempt_id, status, session_id, sequence,
				  practice_problem_json, metadata_json)
				 VALUES ('practice-3', 'learner-1', 'assessment-complete', 'answered',
				  'session-1', 2, ?, ?)`
			)
				.bind(problem, metadata)
				.run()
		).rejects.toThrow();

		const foreignKeyCheck = await testEnv.DB.prepare('PRAGMA foreign_key_check').all();
		expect(foreignKeyCheck.results).toHaveLength(0);
		const migrationCount = await testEnv.DB.prepare(
			'SELECT count(*) AS count FROM d1_migrations'
		).first<{ count: number }>();
		expect(migrationCount?.count).toBe(testEnv.TEST_MIGRATIONS.length);
		const assessmentIndexes = await testEnv.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'assessment_attempt'"
		).all<{ name: string }>();
		expect(assessmentIndexes.results.map(({ name }) => name)).toContain(
			'assessment_attempt_one_in_progress_idx'
		);
		const practiceIndexes = await testEnv.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'practice_attempt'"
		).all<{ name: string }>();
		expect(practiceIndexes.results.map(({ name }) => name)).toEqual(
			expect.arrayContaining([
				'practice_attempt_one_presented_idx',
				'practice_attempt_session_sequence_idx'
			])
		);
	});

	it('upgrades legacy rows and preserves their ownership relationships', async () => {
		expect.assertions(9);
		const upgradeDb = testEnv.UPGRADE_DB;
		await applyD1Migrations(upgradeDb, testEnv.TEST_MIGRATIONS.slice(0, 5));
		await insertUser('legacy-learner', upgradeDb);
		await upgradeDb
			.prepare(
				`INSERT INTO assessment_attempt
			 (id, learner_user_id, status, selected_items_json, responses_json)
			 VALUES ('legacy-assessment', 'legacy-learner', 'skill_diagnosed', '[]', '[]')`
			)
			.run();
		await upgradeDb
			.prepare(
				`INSERT INTO practice_attempt
			 (id, learner_user_id, assessment_attempt_id, practice_problem_json, answer,
			  feedback_json, metadata_json)
			 VALUES ('legacy-practice', 'legacy-learner', 'legacy-assessment', '{}', 'a', '{}', '{}')`
			)
			.run();

		await applyD1Migrations(upgradeDb, testEnv.TEST_MIGRATIONS);
		const assessment = await upgradeDb
			.prepare(
				`SELECT status, definition_version AS definitionVersion, intake_json AS intakeJson,
			 updated_at AS updatedAt, completed_at AS completedAt
			 FROM assessment_attempt WHERE id = 'legacy-assessment'`
			)
			.first<{
				status: string;
				definitionVersion: number;
				intakeJson: string;
				updatedAt: number;
				completedAt: number;
			}>();
		expect(assessment?.status).toBe('completed');
		expect(assessment?.definitionVersion).toBe(1);
		expect(JSON.parse(assessment?.intakeJson ?? '{}')).toMatchObject({ timeZone: 'UTC' });
		expect(assessment?.updatedAt).toBeTypeOf('number');
		expect(assessment?.completedAt).toBeTypeOf('number');

		const practice = await upgradeDb
			.prepare(
				`SELECT status, session_id AS sessionId, sequence, answered_at AS answeredAt
			 FROM practice_attempt WHERE id = 'legacy-practice'`
			)
			.first<{ status: string; sessionId: string; sequence: number; answeredAt: number }>();
		expect(practice).toMatchObject({
			status: 'answered',
			sessionId: 'legacy-practice',
			sequence: 1
		});
		expect(practice?.answeredAt).toBeTypeOf('number');
		const foreignKeyCheck = await upgradeDb.prepare('PRAGMA foreign_key_check').all();
		expect(foreignKeyCheck.results).toHaveLength(0);
		await upgradeDb.prepare("DELETE FROM user WHERE id = 'legacy-learner'").run();
		const remaining = await upgradeDb
			.prepare(
				`SELECT
			 (SELECT count(*) FROM assessment_attempt) AS assessments,
			 (SELECT count(*) FROM practice_attempt) AS practice`
			)
			.first<{ assessments: number; practice: number }>();
		expect(remaining).toEqual({ assessments: 0, practice: 0 });
	});
});
