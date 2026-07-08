import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview -- --env-file .env.test',
		port: 4173,
		env: {
			DATABASE_URL: 'file:local.db',
			ORIGIN: 'http://localhost:4173',
			BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
			GITHUB_CLIENT_ID: 'test-client-id',
			GITHUB_CLIENT_SECRET: 'test-client-secret'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
