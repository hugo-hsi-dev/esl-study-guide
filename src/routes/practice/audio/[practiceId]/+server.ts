import { error, type RequestHandler } from '@sveltejs/kit';
import {
	AssessmentAudioUnavailableError,
	assessmentAudioResponse,
	generateAssessmentAudio,
	loadReviewedAssessmentAudio
} from '$lib/server/assessment-audio';
import {
	getPracticeListeningAudioSource,
	markPracticeListeningAudioDelivered
} from '$lib/server/adaptive-practice';
import { getDb } from '$lib/server/db';
import { requireRole } from '$lib/server/roles';

export const GET: RequestHandler = async (event) => {
	const learner = requireRole(event, 'learner');
	const practiceId = event.params.practiceId;
	if (!practiceId) error(404, 'Listening practice audio was not found.');

	const db = getDb(event.platform?.env.DB);
	const source = await getPracticeListeningAudioSource(db, learner.id, practiceId);
	if (!source) error(404, 'Listening practice audio was not found.');

	try {
		const audio =
			(await loadReviewedAssessmentAudio(source, event.url, event.fetch)) ??
			(await generateAssessmentAudio(source, event.platform?.env));
		const response = assessmentAudioResponse(audio);
		response.headers.set('cache-control', 'private, max-age=300');
		response.headers.set('x-practice-audio', 'available');
		return response;
	} catch (cause) {
		if (cause instanceof AssessmentAudioUnavailableError) {
			error(503, 'Listening audio is unavailable, so this response will not be scored.');
		}
		throw cause;
	}
};

export const POST: RequestHandler = async (event) => {
	const learner = requireRole(event, 'learner');
	const practiceId = event.params.practiceId;
	if (!practiceId) error(404, 'Listening practice was not found.');

	const db = getDb(event.platform?.env.DB);
	const source = await getPracticeListeningAudioSource(db, learner.id, practiceId);
	if (!source) error(404, 'Listening practice was not found.');
	if (!(await markPracticeListeningAudioDelivered(db, learner.id, practiceId))) {
		error(409, 'Listening playback could not be confirmed.');
	}

	return new Response(null, {
		status: 204,
		headers: { 'cache-control': 'private, no-store' }
	});
};
