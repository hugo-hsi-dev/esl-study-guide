import { form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	AssessmentAttemptInputError,
	saveAssessmentAttempt
} from '$lib/server/assessment-attempts';
import { getLearnerAssessmentItems } from '$lib/server/assessment-items';
import { getDb } from '$lib/server/db';
import { requireRole } from '$lib/server/roles';

type AssessmentResponseInput = {
	itemId?: string;
	answer?: string;
	speakingSeconds?: number;
};

type AssessmentFormInput = {
	responses?: AssessmentResponseInput[];
};

const toAssessmentFormData = (data: AssessmentFormInput) => {
	const formData = new FormData();

	for (const response of data.responses ?? []) {
		if (!response.itemId) continue;
		if (response.answer !== undefined) formData.set(`answer:${response.itemId}`, response.answer);
		if (response.speakingSeconds !== undefined) {
			formData.set(`speakingSeconds:${response.itemId}`, String(response.speakingSeconds));
		}
	}

	return formData;
};

export const getAssessmentPage = query(() => {
	const user = requireRole('learner');
	return { learnerName: user.name, items: getLearnerAssessmentItems() };
});

export const submitAssessment = form('unchecked', async (data: AssessmentFormInput) => {
	const user = requireRole('learner');

	try {
		const attempt = await saveAssessmentAttempt(getDb(), user.id, toAssessmentFormData(data));
		return { saved: true, attemptId: attempt.id, status: attempt.status };
	} catch (error) {
		if (error instanceof AssessmentAttemptInputError) invalid(error.message);
		throw error;
	}
});
