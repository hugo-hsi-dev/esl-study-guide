import { query } from '$app/server';
import { requireRole } from '$lib/server/roles';

export const getTestGuide = query(async () => {
	const learner = requireRole('learner');
	return { learnerName: learner.name };
});
