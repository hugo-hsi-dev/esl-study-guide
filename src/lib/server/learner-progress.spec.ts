import { describe, expect, it } from 'vitest';
import { getWeeklySessionTarget, summarizeSignalPerformance } from './learner-progress';

describe('learner progress evidence', () => {
	it('keeps reading and listening evidence separate for the same signal', () => {
		const performance = summarizeSignalPerformance([
			{ area: 'reading', signal: 'detail', correct: true },
			{ area: 'reading', signal: 'detail', correct: false },
			{ area: 'listening', signal: 'detail', correct: true }
		]);

		expect(performance).toEqual(
			expect.arrayContaining([
				{
					area: 'reading',
					signal: 'detail',
					attempts: 2,
					correct: 1,
					accuracy: 0.5
				},
				{
					area: 'listening',
					signal: 'detail',
					attempts: 1,
					correct: 1,
					accuracy: 1
				}
			])
		);
	});
});

describe('test-date pacing', () => {
	it('spreads the remaining evidence sessions across the weeks before a future test', () => {
		expect(
			getWeeklySessionTarget({
				now: new Date('2026-07-11T12:00:00.000Z'),
				testDate: '2026-08-08',
				remainingResponses: 20,
				requiredSessions: 4,
				completedSessions: 0
			})
		).toEqual({ target: 1, basedOnTestDate: true });
	});

	it('uses an intensive bounded goal when no future date is available', () => {
		expect(
			getWeeklySessionTarget({
				now: new Date('2026-07-11T12:00:00.000Z'),
				remainingResponses: 20,
				requiredSessions: 4,
				completedSessions: 0
			})
		).toEqual({ target: 5, basedOnTestDate: false });
	});
});
