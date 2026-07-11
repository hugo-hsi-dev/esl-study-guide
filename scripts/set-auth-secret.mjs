import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const envFlag = process.argv.indexOf('--env');
const environment = envFlag >= 0 ? process.argv[envFlag + 1] : undefined;
if (envFlag >= 0 && !environment) throw new Error('--env requires a Wrangler environment name');

for (const envFile of [environment ? `.env.${environment}` : '', '.env']) {
	if (!envFile || !existsSync(envFile)) continue;
	for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (!match || process.env[match[1]]) continue;
		process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
	}
}

const secret = process.argv.includes('--generate')
	? randomBytes(32).toString('base64url')
	: process.env.BETTER_AUTH_SECRET?.trim();
if (!secret || secret.length < 32)
	throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');

const result = spawnSync(
	'pnpm',
	[
		'exec',
		'wrangler',
		'secret',
		'put',
		'BETTER_AUTH_SECRET',
		...(environment ? ['--env', environment] : [])
	],
	{
		input: `${secret}\n`,
		stdio: ['pipe', 'inherit', 'inherit']
	}
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
	`Configured BETTER_AUTH_SECRET for ${environment ?? 'production'} without printing it.`
);
