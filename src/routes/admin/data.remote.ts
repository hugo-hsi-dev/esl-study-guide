import { query } from '$app/server';
import { desc } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { assessmentAttempt, practiceAttempt } from '$lib/server/db/schema';
import { requireRole } from '$lib/server/roles';

export const getAdminPage = query(async () => {
	const admin = requireRole('admin');
	const db = getDb();
	const [assessmentAttempts, practiceAttempts] = await Promise.all([
		db.select().from(assessmentAttempt).orderBy(desc(assessmentAttempt.createdAt)).limit(20),
		db.select().from(practiceAttempt).orderBy(desc(practiceAttempt.createdAt)).limit(20)
	]);

	return { adminName: admin.name, assessmentAttempts, practiceAttempts };
});
