import { describe, expect, it } from 'vitest';
import { saveAssessmentAttempt } from './assessment-attempts';
import { getLearnerAssessmentItems } from './assessment-items';
import type { Db } from './db';

describe('saveAssessmentAttempt', () => {
	it('saves one diagnosed attempt with all six assessed areas', async () => {
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
			studyPlanJson: { today: string[] };
			diagnosisMetadataJson: { model: string; schemaVersion: number };
		};

		expect(row.learnerUserId).toBe('learner-1');
		expect(row.status).toBe('skill_diagnosed');
		expect(row.selectedItemsJson.map((item) => item.area).sort()).toEqual([
			'grammar_usage',
			'listening',
			'reading',
			'speaking',
			'vocabulary',
			'writing'
		]);
		expect(row.responsesJson.map((response) => response.area).sort()).toEqual([
			'grammar_usage',
			'listening',
			'reading',
			'speaking',
			'vocabulary',
			'writing'
		]);
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
		expect(row.skillProfileJson.skillBands.writing).toBe('emerging');
		expect(row.skillProfileJson.priorityWeaknesses.length).toBeGreaterThan(0);
		expect(row.skillProfileJson.rubricOutputs.pronunciation).toEqual({
			score: null,
			signals: [],
			feedback: 'No learner audio file is available for pronunciation judgment.'
		});
		expect(row.studyPlanJson.today.length).toBeGreaterThan(0);
		expect(row.diagnosisMetadataJson).toMatchObject({
			model: 'deterministic-diagnosis',
			schemaVersion: 1
		});
		expect(result.status).toBe('skill_diagnosed');
	});
});
