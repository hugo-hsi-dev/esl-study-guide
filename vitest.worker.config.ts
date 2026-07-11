import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		cloudflareTest(async () => ({
			miniflare: {
				compatibilityDate: '2026-07-08',
				compatibilityFlags: ['nodejs_als'],
				d1Databases: {
					DB: 'esl-study-guide-test',
					UPGRADE_DB: 'esl-study-guide-upgrade-test'
				},
				bindings: {
					TEST_MIGRATIONS: await readD1Migrations(path.join(root, 'drizzle'))
				}
			}
		}))
	],
	test: {
		include: ['tests/workers/**/*.test.ts']
	}
});
