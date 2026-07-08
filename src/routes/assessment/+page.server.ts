import { fail } from '@sveltejs/kit';
import {
	AssessmentAttemptInputError,
	saveAssessmentAttempt
} from '$lib/server/assessment-attempts';
import { getLearnerAssessmentItems } from '$lib/server/assessment-items';
import { getDb } from '$lib/server/db';
import { requireRole } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const user = requireRole(event, 'learner');
	return { learnerName: user.name, items: getLearnerAssessmentItems() };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'learner');

		try {
			const attempt = await saveAssessmentAttempt(getDb(), user.id, await event.request.formData());
			return { saved: true, attemptId: attempt.id, status: attempt.status };
		} catch (error) {
			if (error instanceof AssessmentAttemptInputError) {
				return fail(400, { message: error.message });
			}
			throw error;
		}
	}
};
