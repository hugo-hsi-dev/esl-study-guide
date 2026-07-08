import { getRequestEvent } from '$app/server';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export const getDb = (database = getRequestEvent().platform?.env.DB) => {
	if (!database) throw new Error('Cloudflare D1 binding DB is not available');
	return drizzle(database, { schema });
};

export type Db = ReturnType<typeof getDb>;
