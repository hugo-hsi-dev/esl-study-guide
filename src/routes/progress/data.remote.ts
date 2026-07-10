import { query } from '$app/server';
import { getDb } from '$lib/server/db';
import { bandChanges, getLearnerProductData } from '$lib/server/learner-progress';
import { requireRole } from '$lib/server/roles';

export const getProgress = query(async () => {
	const user = requireRole('learner');
	const dashboard = await getLearnerProductData(getDb(), user.id);
	return {
		learnerName: user.name,
		...dashboard,
		bandChanges: bandChanges(dashboard.assessmentHistory)
	};
});
