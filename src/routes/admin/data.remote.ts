import { query } from '$app/server';
import { getDb } from '$lib/server/db';
import { bandChanges, getAdminProductData } from '$lib/server/learner-progress';
import { requireRole } from '$lib/server/roles';

export const getAdminDashboard = query(async () => {
	const admin = requireRole('admin');
	const data = await getAdminProductData(getDb());
	return {
		adminName: admin.name,
		...data,
		bandChanges: data.dashboard ? bandChanges(data.dashboard.assessmentHistory) : []
	};
});
