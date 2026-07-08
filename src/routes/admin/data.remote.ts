import { query } from '$app/server';
import { requireRole } from '$lib/server/roles';

export const getAdminPage = query(() => {
	const user = requireRole('admin');
	return { adminName: user.name };
});
