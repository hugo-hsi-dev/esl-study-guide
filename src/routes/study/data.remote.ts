import { query } from '$app/server';
import { getDb } from '$lib/server/db';
import { getLearnerProductData } from '$lib/server/learner-progress';
import { requireRole } from '$lib/server/roles';

export const getLearnerDashboard = query(async () => {
	const user = requireRole('learner');
	return {
		learnerName: user.name,
		...(await getLearnerProductData(getDb(), user.id))
	};
});
