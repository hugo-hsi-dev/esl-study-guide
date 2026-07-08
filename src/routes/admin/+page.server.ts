import { requireRole } from '$lib/server/roles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const user = requireRole(event, 'admin');
	return { adminName: user.name };
};
