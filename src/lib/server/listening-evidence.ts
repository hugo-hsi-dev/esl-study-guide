import { z } from 'zod';

const acknowledgementPayloadSchema = z.object({
	schemaVersion: z.literal(1),
	learnerUserId: z.string().trim().min(1).max(200),
	attemptId: z.string().trim().min(1).max(200),
	itemId: z.string().trim().min(1).max(100),
	itemVersion: z.number().int().min(1),
	acknowledgedAt: z.number().int().nonnegative()
});

export type AssessmentListeningAcknowledgement = z.infer<typeof acknowledgementPayloadSchema>;

const encoder = new TextEncoder();
const maxAcknowledgementAgeMs = 2 * 60 * 60 * 1000;

const encodeBase64Url = (bytes: Uint8Array) => {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
};

const decodeBase64Url = (value: string) => {
	const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const signingKey = (secret: string) =>
	crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);

export async function issueAssessmentListeningAcknowledgement(
	payload: Omit<AssessmentListeningAcknowledgement, 'schemaVersion' | 'acknowledgedAt'>,
	secret: string,
	now = new Date()
) {
	const parsed = acknowledgementPayloadSchema.parse({
		...payload,
		schemaVersion: 1,
		acknowledgedAt: now.getTime()
	});
	const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(parsed)));
	const signature = await crypto.subtle.sign(
		'HMAC',
		await signingKey(secret),
		encoder.encode(encodedPayload)
	);
	return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAssessmentListeningAcknowledgement(
	token: string,
	expected: Omit<AssessmentListeningAcknowledgement, 'schemaVersion' | 'acknowledgedAt'>,
	secret: string,
	now = new Date()
) {
	try {
		const [encodedPayload, encodedSignature, extra] = token.split('.');
		if (!encodedPayload || !encodedSignature || extra) return false;
		const validSignature = await crypto.subtle.verify(
			'HMAC',
			await signingKey(secret),
			decodeBase64Url(encodedSignature),
			encoder.encode(encodedPayload)
		);
		if (!validSignature) return false;
		const payload = acknowledgementPayloadSchema.parse(
			JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload)))
		);
		const age = now.getTime() - payload.acknowledgedAt;
		return (
			age >= 0 &&
			age <= maxAcknowledgementAgeMs &&
			payload.learnerUserId === expected.learnerUserId &&
			payload.attemptId === expected.attemptId &&
			payload.itemId === expected.itemId &&
			payload.itemVersion === expected.itemVersion
		);
	} catch {
		return false;
	}
}
