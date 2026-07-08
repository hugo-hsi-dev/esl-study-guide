import { building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/hooks';
import { z } from 'zod';

const requiredUnlessBuilding = building ? z.string().optional() : z.string();

export const variables = defineEnvVars({
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.',
		schema: requiredUnlessBuilding
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).',
		schema: requiredUnlessBuilding
	},
	GITHUB_CLIENT_ID: {
		description:
			'Optional GitHub OAuth client ID. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).',
		schema: z.string().optional()
	},
	GITHUB_CLIENT_SECRET: {
		description:
			'Optional GitHub OAuth client secret. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).',
		schema: z.string().optional()
	},
	ADMIN_EMAILS: {
		description: 'Comma-separated emails that should receive the Admin role on account creation.',
		schema: requiredUnlessBuilding
	},
	CLOUDFLARE_ACCOUNT_ID: {
		description: 'Cloudflare account ID for opt-in Workers AI ai/run checks.',
		schema: z.string().optional()
	},
	CLOUDFLARE_API_TOKEN: {
		description:
			'Cloudflare API token for opt-in Workers AI ai/run checks. Leave unset for deterministic local/test stubs.',
		schema: z.string().optional()
	},
	WORKERS_AI_TEXT_MODEL_ID: {
		description: 'Configurable Workers AI text model ID for feedback and practice generation.',
		schema: z.string().default('@cf/zai-org/glm-4.7-flash')
	},
	WORKERS_AI_TRANSCRIPTION_MODEL_ID: {
		description: 'Configurable Workers AI transcription model ID for speaking feedback.',
		schema: z.string().default('@cf/openai/whisper-large-v3-turbo')
	},
	WORKERS_AI_TTS_MODEL_ID: {
		description: 'Configurable Workers AI text-to-speech model ID for listening prompts.',
		schema: z.string().default('@cf/myshell-ai/melotts')
	}
});
