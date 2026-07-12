export async function readAudioDurationSeconds(file: File, maximumSeconds: number) {
	const objectUrl = URL.createObjectURL(file);
	try {
		const duration = await new Promise<number>((resolve, reject) => {
			const audio = new Audio();
			let timeout = 0;
			const cleanup = () => {
				window.clearTimeout(timeout);
				audio.onloadedmetadata = null;
				audio.onerror = null;
			};
			timeout = window.setTimeout(() => {
				cleanup();
				reject(new Error('Audio metadata timed out.'));
			}, 10_000);
			audio.preload = 'metadata';
			audio.onloadedmetadata = () => {
				cleanup();
				if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
					reject(new Error('Audio duration is unavailable.'));
					return;
				}
				resolve(audio.duration);
			};
			audio.onerror = () => {
				cleanup();
				reject(new Error('Audio metadata could not be read.'));
			};
			audio.src = objectUrl;
		});
		return Math.min(maximumSeconds, Math.max(1, Math.round(duration)));
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}
