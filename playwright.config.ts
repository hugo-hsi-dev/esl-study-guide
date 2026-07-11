import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
	use: { baseURL: externalBaseURL ?? 'http://127.0.0.1:4173' },
	timeout: 60_000,
	webServer: externalBaseURL
		? undefined
		: {
				command:
					'pnpm db:push:e2e && pnpm auth:seed:e2e && pnpm data:reset -- --env e2e && pnpm build && pnpm preview:e2e',
				port: 4173,
				timeout: 120_000,
				reuseExistingServer: !process.env.CI,
				env: {
					ORIGIN: 'http://127.0.0.1:4173',
					BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
					ADMIN_USERNAME: 'admin',
					ADMIN_PASSWORD: 'admin-password',
					ADMIN_NAME: 'Test Admin',
					LEARNER_USERNAME: 'learner',
					LEARNER_PASSWORD: 'learner-password',
					LEARNER_NAME: 'Test Learner',
					CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true'
				}
			},
	testMatch: '**/*.e2e.{ts,js}'
});
