import { form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { z } from 'zod';
import {
	generatePracticeProblem,
	getLatestPracticeProblem,
	savePracticeAttempt,
	validatePracticeMetadata,
	validatePracticeProblem
} from '$lib/server/adaptive-practice';
import {
	AssessmentAttemptInputError,
	saveAssessmentAttempt
} from '$lib/server/assessment-attempts';
import { getLearnerAssessmentItems } from '$lib/server/assessment-items';
import { getDb } from '$lib/server/db';
import { requireRole } from '$lib/server/roles';
import { AiOutputValidationError } from '$lib/server/workers-ai';

const assessmentFormSchema = z.object({
	responses: z
		.array(
			z.object({
				itemId: z.string(),
				answer: z.string().optional(),
				speakingSeconds: z.number().optional(),
				speakingTranscript: z.string().optional(),
				speakingAudio: z.file().optional()
			})
		)
		.optional()
});

const practiceFormSchema = z.object({
	answer: z.string().optional(),
	problemJson: z.string().optional(),
	metadataJson: z.string().optional()
});

type AssessmentFormInput = z.infer<typeof assessmentFormSchema>;

const toAssessmentFormData = (data: AssessmentFormInput) => {
	const formData = new FormData();

	for (const response of data.responses ?? []) {
		if (!response.itemId) continue;
		if (response.answer !== undefined) formData.set(`answer:${response.itemId}`, response.answer);
		if (response.speakingSeconds !== undefined) {
			formData.set(`speakingSeconds:${response.itemId}`, String(response.speakingSeconds));
		}
		if (response.speakingTranscript !== undefined) {
			formData.set(`speakingTranscript:${response.itemId}`, response.speakingTranscript);
		}
		if (response.speakingAudio !== undefined) {
			formData.set(`speakingAudio:${response.itemId}`, response.speakingAudio);
		}
	}

	return formData;
};

export const getAssessmentPage = query(async () => {
	const user = requireRole('learner');
	return {
		learnerName: user.name,
		items: getLearnerAssessmentItems(),
		practice: await getLatestPracticeProblem(getDb(), user.id)
	};
});

export const submitAssessment = form(assessmentFormSchema, async (data) => {
	const user = requireRole('learner');

	try {
		const attempt = await saveAssessmentAttempt(getDb(), user.id, toAssessmentFormData(data));
		return {
			saved: true,
			attemptId: attempt.id,
			status: attempt.status,
			skillProfile: attempt.skillProfile,
			studyPlan: attempt.studyPlan,
			practice: {
				assessmentAttemptId: attempt.id,
				...(await generatePracticeProblem({
					skillProfile: attempt.skillProfile,
					studyPlan: attempt.studyPlan,
					recentResponses: attempt.responses
				}))
			}
		};
	} catch (error) {
		if (error instanceof AssessmentAttemptInputError) invalid(error.message);
		if (error instanceof AiOutputValidationError) {
			invalid('AI assessment output could not be validated. Try again.');
		}
		throw error;
	}
});

export const submitPractice = form(practiceFormSchema, async (data) => {
	const user = requireRole('learner');
	const answer = data.answer ?? '';
	if (!answer) invalid('Choose an answer.');

	try {
		const submitted =
			data.problemJson && data.metadataJson
				? {
						problem: validatePracticeProblem(JSON.parse(data.problemJson)),
						metadata: validatePracticeMetadata(JSON.parse(data.metadataJson))
					}
				: undefined;
		const result = await savePracticeAttempt(getDb(), user.id, answer, submitted);
		if (!result) invalid('Complete an assessment before practice.');

		return result;
	} catch (error) {
		if (
			error instanceof SyntaxError ||
			error instanceof z.ZodError ||
			error instanceof AiOutputValidationError
		) {
			invalid('Practice problem could not be validated. Refresh and try again.');
		}
		throw error;
	}
});
