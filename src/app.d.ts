import type { Session, User } from 'better-auth';

type LocalUser = User & {
	role?: string | null;
	username?: string | null;
	displayUsername?: string | null;
};

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			user?: LocalUser;
			session?: Session;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
