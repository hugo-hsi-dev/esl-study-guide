import { describe, expect, it } from 'vitest';
import { authorizeAssessmentResponse, saveAssessmentAttempt } from './assessment-attempts';
import { getLearnerAssessmentItems } from './assessment-items';
import type { Db } from './db';

const includesSqlParameter = (
	value: unknown,
	expected: string,
	visited = new Set<object>()
): boolean => {
	if (value === expected) return true;
	if (!value || typeof value !== 'object') return false;
	if (visited.has(value)) return false;
	visited.add(value);
	return Object.values(value).some((entry) => includesSqlParameter(entry, expected, visited));
};

describe('saveAssessmentAttempt', () => {
	it('rejects an assessment attempt owned by another learner', async () => {
		const item = getLearnerAssessmentItems()[0];
		if (!item) throw new Error('Expected an assessment item.');
		const foreignAttempt = {
			id: 'attempt-1',
			learnerUserId: 'other-learner',
			status: 'in_progress' as const,
			definitionVersion: 2,
			intakeJson: {
				goal: 'Use English at work',
				selfRatings: { speaking: 3, reading: 3, writing: 3 },
				timeZone: 'UTC'
			},
			selectedItemsJson: [{ id: item.id, version: item.version, area: item.area }],
			responsesJson: [],
			skillProfileJson: null,
			studyPlanJson: null,
			diagnosisMetadataJson: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			completedAt: null
		};
		let queriedWithLearnerOwnership = false;
		const db = {
			select: () => ({
				from: () => ({
					where: (condition: unknown) => {
						queriedWithLearnerOwnership = includesSqlParameter(condition, 'learner-1');
						return {
							limit: async () => (queriedWithLearnerOwnership ? [] : [foreignAttempt])
						};
					}
				})
			})
		} as unknown as Db;

		await expect(
			authorizeAssessmentResponse(db, 'learner-1', {
				attemptId: foreignAttempt.id,
				itemId: item.id
			})
		).rejects.toThrow('Assessment attempt was not found.');
		expect(queriedWithLearnerOwnership).toBe(true);
	});

	it('saves a completed 14-task attempt with evidence-calibrated results', async () => {
		const formData = new FormData();
		for (const item of getLearnerAssessmentItems()) {
			if (item.area === 'writing') {
				formData.set(
					`answer:${item.id}`,
					'Last week I fixed a bill. I called support. They helped me.'
				);
			} else if (item.area === 'speaking') {
				formData.set(`speakingSeconds:${item.id}`, '42');
			} else {
				formData.set(`answer:${item.id}`, item.learnerTask.choices?.[0]?.id ?? '');
			}
		}

		const rows: unknown[] = [];
		const db = {
			insert: () => ({
				values: async (row: unknown) => {
					rows.push(row);
				}
			})
		} as unknown as Pick<Db, 'insert'>;

		const result = await saveAssessmentAttempt(db, 'learner-1', formData);
		const row = rows[0] as {
			learnerUserId: string;
			status: string;
			selectedItemsJson: { area: string }[];
			responsesJson: { area: string; kind: string; metadata?: unknown }[];
			skillProfileJson: {
				skillBands: Record<string, string>;
				evidenceCounts: Record<string, number>;
				diagnosisQuality: string;
				priorityWeaknesses: { signal: string }[];
				rubricOutputs: { pronunciation: { score: null; feedback: string } };
			};
			studyPlanJson: { reassessAfterPracticeCount: number };
			diagnosisMetadataJson: {
				modelId: string;
				schemaVersion: number;
				fallbackReason?: string;
			};
		};

		expect(row.learnerUserId).toBe('learner-1');
		expect(row.status).toBe('completed');
		expect([...new Set(row.selectedItemsJson.map((item) => item.area))].sort()).toEqual([
			'grammar_usage',
			'listening',
			'reading',
			'speaking',
			'vocabulary',
			'writing'
		]);
		expect(row.responsesJson).toHaveLength(14);
		expect(row.responsesJson.find((response) => response.area === 'writing')?.kind).toBe(
			'writing_text'
		);
		expect(row.responsesJson.find((response) => response.area === 'speaking')).toEqual({
			area: 'speaking',
			itemId: 'speak-recent-purchase',
			itemVersion: 1,
			kind: 'speaking_metadata',
			metadata: { representedBy: 'temporary_metadata', responseSeconds: 42 }
		});
		expect(row.skillProfileJson.skillBands.writing).toBe('insufficient_evidence');
		expect(row.skillProfileJson.evidenceCounts.writing).toBe(1);
		expect(row.skillProfileJson.diagnosisQuality).toBe('limited');
		expect(row.skillProfileJson.priorityWeaknesses.length).toBeGreaterThan(0);
		expect(row.skillProfileJson.rubricOutputs.pronunciation).toEqual({
			score: null,
			signals: [],
			feedback:
				'Pronunciation is not scored in this first check. It needs dedicated speech evaluation.'
		});
		expect(row.studyPlanJson.reassessAfterPracticeCount).toBe(20);
		expect(row.diagnosisMetadataJson).toMatchObject({
			modelId: 'evidence-calibrated-diagnosis',
			schemaVersion: 2,
			fallbackReason: 'productive_scoring_deferred'
		});
		expect(result.status).toBe('completed');
	});
});
