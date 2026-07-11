/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `esl-study-${version}`;
const staticFiles = files.filter((file) => /\.(?:svg|png|webmanifest)$/.test(file));
const cachedAssets = new Set([...build, ...staticFiles]);

worker.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(cachedAssets)));
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
			)
	);
});

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== worker.location.origin || !cachedAssets.has(url.pathname)) return;
	event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
