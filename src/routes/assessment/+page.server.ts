import { requireRole } from '$lib/server/roles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const user = requireRole(event, 'learner');
	return { learnerName: user.name };
};
