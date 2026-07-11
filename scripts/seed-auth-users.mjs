import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { hashPassword } from 'better-auth/crypto';

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

const required = (name) => {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
};

const normalizeUsername = (username) => username.trim().toLowerCase();
const internalEmailForUsername = (username) =>
	`${normalizeUsername(username).replace(/[^a-z0-9_.-]/g, '-')}.user@internal.esl-study-guide.test`;
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const users = [
	{
		id: randomUUID(),
		username: normalizeUsername(required('ADMIN_USERNAME')),
		password: required('ADMIN_PASSWORD'),
		name: required('ADMIN_NAME'),
		role: 'admin'
	},
	{
		id: randomUUID(),
		username: normalizeUsername(required('LEARNER_USERNAME')),
		password: required('LEARNER_PASSWORD'),
		name: required('LEARNER_NAME'),
		role: 'learner'
	}
];

if (users[0].username === users[1].username)
	throw new Error('ADMIN_USERNAME and LEARNER_USERNAME must differ');

const now = Date.now();
const rows = await Promise.all(
	users.map(async (user) => ({
		...user,
		email: internalEmailForUsername(user.username),
		displayUsername: user.username,
		passwordHash: await hashPassword(user.password)
	}))
);
const userValues = rows
	.map(
		(user) =>
			`(${sql(user.id)}, ${sql(user.name)}, ${sql(user.email)}, 1, ${now}, ${now}, ${sql(user.username)}, ${sql(user.displayUsername)}, ${sql(user.role)})`
	)
	.join(', ');
const passwordValues = rows
	.map((user) => `(${sql(user.username)}, ${sql(user.passwordHash)})`)
	.join(', ');

const command = `
INSERT INTO user (id, name, email, email_verified, created_at, updated_at, username, display_username, role)
VALUES ${userValues}
ON CONFLICT(username) DO UPDATE SET
	name = excluded.name,
	email = excluded.email,
	email_verified = excluded.email_verified,
	updated_at = excluded.updated_at,
	display_username = excluded.display_username,
	role = excluded.role;
WITH seed(username, password) AS (VALUES ${passwordValues})
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT user.id || ':credential', user.id, 'credential', user.id, seed.password, ${now}, ${now}
FROM user
JOIN seed ON user.username = seed.username
WHERE 1
ON CONFLICT(id) DO UPDATE SET
	account_id = excluded.account_id,
	user_id = excluded.user_id,
	password = excluded.password,
	updated_at = excluded.updated_at;`;

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
		command
	],
	{ stdio: 'inherit' }
);

if (result.status !== 0) process.exit(result.status ?? 1);

console.log(
	`Seeded ${rows.length} fixed auth users in ${environment ? `${environment} ` : ''}${remote ? 'remote' : 'local'} D1.`
);
