import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

if (!process.argv.includes('--yes')) {
	throw new Error('Refusing to delete study history without --yes');
}

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

const learnerUsername = process.env.LEARNER_USERNAME?.trim().toLowerCase();
if (!learnerUsername) throw new Error('LEARNER_USERNAME is required');
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const remote = process.argv.includes('--remote');
const result = spawnSync(
	'pnpm',
	[
		'exec',
		'wrangler',
		'd1',
		'execute',
		'DB',
		remote ? '--remote' : '--local',
		...(environment ? ['--env', environment] : []),
		'--command',
		`DELETE FROM assessment_attempt WHERE learner_user_id IN (SELECT id FROM user WHERE username = ${sql(learnerUsername)});`
	],
	{ stdio: 'inherit' }
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log('Deleted Learner study history; the fixed account was preserved.');
