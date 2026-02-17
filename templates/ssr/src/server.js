import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import config from '../ripple.config.js';
import { createApp, createProdHandler } from '@ripple-ts/meta';

const app = createApp({
	routes: config.routes,
	mode: config.mode,
});

for (const middleware of config.app?.middlewares ?? []) {
	app.use(middleware);
}

const is_production = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';

let active_fetch = app.fetch;
let active_middleware = null;

if (!is_production) {
	const { createDevHandler } = await import('@ripple-ts/meta/dev');
	const dev = await createDevHandler(app, { root: process.cwd(), template: 'index.html' });
	active_fetch = dev.fetch;
	active_middleware = dev.middleware;
} else {
	const template = await readFile(new URL('../client/index.html', import.meta.url), 'utf-8');
	active_fetch = createProdHandler(app, { template }).fetch;
}

export function fetch(request, platform) {
	return active_fetch(request, platform);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const server = config.adapter.serve(fetch, {
		port: config.port,
		middleware: active_middleware,
	});
	server.listen();
}
