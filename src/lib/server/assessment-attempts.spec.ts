import { describe, expect, it } from 'vitest';
import { authorizeAssessmentResponse, saveAssessmentAttempt } from './assessment-attempts';
import { getLearnerAssessmentItems } from './assessment-items';
import type { Db } from './db';

describe('saveAssessmentAttempt', () => {
	it('rejects a foreign assessment attempt before building a response draft', async () => {
		expect.assertions(1);
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({ limit: async () => [] })
				})
			})
		} as unknown as Db;

		await expect(
			authorizeAssessmentResponse(db, 'learner-1', {
				attemptId: crypto.randomUUID(),
				itemId: 'speak-recent-purchase'
			})
		).rejects.toThrow('Assessment attempt was not found.');
	});

	it('saves one completed 14-task attempt with honest limited diagnosis', async () => {
		expect.assertions(12);

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
		expect(row.skillProfileJson.priorityWeaknesses.length).toBeGreaterThan(0);
		expect(row.skillProfileJson.rubricOutputs.pronunciation).toEqual({
			score: null,
			signals: [],
			feedback:
				'Pronunciation scoring is deferred; speaking feedback uses transcript-level surface analysis.'
		});
		expect(row.studyPlanJson.reassessAfterPracticeCount).toBe(20);
		expect(row.diagnosisMetadataJson).toMatchObject({
			modelId: 'deterministic-objective-scoring',
			schemaVersion: 2,
			fallbackReason: 'workers_ai_unavailable'
		});
		expect(result.status).toBe('completed');
	});
});
