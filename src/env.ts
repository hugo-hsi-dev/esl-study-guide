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
	ADMIN_USERNAME: {
		description: 'Username for the fixed seeded Admin test account.',
		schema: requiredUnlessBuilding
	},
	ADMIN_PASSWORD: {
		description: 'Password for the fixed seeded Admin test account.',
		schema: requiredUnlessBuilding
	},
	ADMIN_NAME: {
		description: 'Display name for the fixed seeded Admin test account.',
		schema: requiredUnlessBuilding
	},
	LEARNER_USERNAME: {
		description: 'Username for the fixed seeded Learner test account.',
		schema: requiredUnlessBuilding
	},
	LEARNER_PASSWORD: {
		description: 'Password for the fixed seeded Learner test account.',
		schema: requiredUnlessBuilding
	},
	LEARNER_NAME: {
		description: 'Display name for the fixed seeded Learner test account.',
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
		schema: z.string().default('@cf/meta/llama-3.1-8b-instruct-fp8')
	},
	WORKERS_AI_TRANSCRIPTION_MODEL_ID: {
		description: 'Configurable Workers AI transcription model ID for speaking feedback.',
		schema: z.string().default('@cf/openai/whisper-large-v3-turbo')
	},
	WORKERS_AI_TTS_MODEL_ID: {
		description: 'Configurable Workers AI text-to-speech model ID for listening prompts.',
		schema: z.string().default('@cf/deepgram/aura-2-en')
	}
});
