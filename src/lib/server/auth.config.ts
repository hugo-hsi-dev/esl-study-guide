import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

export const auth = betterAuth({
	baseURL: process.env.ORIGIN,
	secret: process.env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(drizzle({} as D1Database, { schema }), { provider: 'sqlite' }),
	disabledPaths: ['/sign-in/email', '/sign-up/email', '/is-username-available'],
	emailAndPassword: { enabled: true, disableSignUp: true },
	user: {
		additionalFields: {
			role: { type: 'string', required: false, input: false }
		}
	},
	plugins: [username()]
});
