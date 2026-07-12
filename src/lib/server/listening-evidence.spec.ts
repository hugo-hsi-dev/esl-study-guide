import { describe, expect, it } from 'vitest';
import {
	issueAssessmentListeningAcknowledgement,
	verifyAssessmentListeningAcknowledgement
} from './listening-evidence';

const expected = {
	learnerUserId: 'learner-1',
	attemptId: 'attempt-1',
	itemId: 'listen-main-idea',
	itemVersion: 2
};
const secret = 'test-secret-that-is-long-enough-for-hmac';
const issuedAt = new Date('2026-07-11T12:00:00.000Z');

describe('assessment listening playback acknowledgements', () => {
	it('accepts a recent signed acknowledgement for the exact learner, attempt, and item', async () => {
		const token = await issueAssessmentListeningAcknowledgement(expected, secret, issuedAt);

		await expect(
			verifyAssessmentListeningAcknowledgement(
				token,
				expected,
				secret,
				new Date('2026-07-11T13:59:59.000Z')
			)
		).resolves.toBe(true);
	});

	it('rejects preload-only, tampered, cross-item, and expired evidence', async () => {
		expect.assertions(4);
		const token = await issueAssessmentListeningAcknowledgement(expected, secret, issuedAt);

		await expect(
			verifyAssessmentListeningAcknowledgement('', expected, secret, issuedAt)
		).resolves.toBe(false);
		await expect(
			verifyAssessmentListeningAcknowledgement(`${token}x`, expected, secret, issuedAt)
		).resolves.toBe(false);
		await expect(
			verifyAssessmentListeningAcknowledgement(
				token,
				{ ...expected, itemId: 'listen-detail' },
				secret,
				issuedAt
			)
		).resolves.toBe(false);
		await expect(
			verifyAssessmentListeningAcknowledgement(
				token,
				expected,
				secret,
				new Date('2026-07-11T14:00:00.001Z')
			)
		).resolves.toBe(false);
	});
});
