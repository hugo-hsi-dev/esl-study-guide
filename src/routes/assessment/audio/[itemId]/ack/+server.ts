import { BETTER_AUTH_SECRET } from '$app/env/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import {
	AssessmentAttemptInputError,
	authorizeAssessmentResponse
} from '$lib/server/assessment-attempts';
import { getDb } from '$lib/server/db';
import { issueAssessmentListeningAcknowledgement } from '$lib/server/listening-evidence';
import { requireRole } from '$lib/server/roles';

const requestSchema = z.object({ attemptId: z.string().uuid() });

export const POST: RequestHandler = async (event) => {
	const learner = requireRole(event, 'learner');
	const itemId = event.params.itemId;
	if (!itemId) error(404, 'Listening task was not found.');
	if (!BETTER_AUTH_SECRET) error(503, 'Listening playback confirmation is unavailable.');

	let request: z.infer<typeof requestSchema>;
	try {
		request = requestSchema.parse(await event.request.json());
	} catch {
		error(400, 'A valid assessment attempt is required.');
	}

	try {
		const authorization = await authorizeAssessmentResponse(
			getDb(event.platform?.env.DB),
			learner.id,
			{ attemptId: request.attemptId, itemId }
		);
		if (authorization.completedState) error(409, 'This assessment is already complete.');
		if (authorization.item.area !== 'listening' || !authorization.item.serverOnlyAudioScript) {
			error(404, 'Listening task was not found.');
		}

		return json({
			token: await issueAssessmentListeningAcknowledgement(
				{
					learnerUserId: learner.id,
					attemptId: request.attemptId,
					itemId,
					itemVersion: authorization.item.version
				},
				BETTER_AUTH_SECRET
			)
		});
	} catch (cause) {
		if (cause instanceof AssessmentAttemptInputError) error(404, cause.message);
		throw cause;
	}
};
