import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { serve } from '../packages/adapter-node/src/index.js';
import { createApp } from '../packages/meta/src/index.js';
import { createDevHandler } from '../packages/meta/src/dev/index.js';
import { RenderRoute, ServerRoute } from '../packages/meta/src/routing/index.js';

const root = dirname(fileURLToPath(import.meta.url));

const app = createApp({
	routes: [
		new RenderRoute({ path: '/', entry: '/src/MetaApp.ripple' }),
		new ServerRoute({
			path: '/api/hello',
			methods: ['GET'],
			handler: async () =>
				Response.json({
					message: 'Hello from Meta SSR-only demo',
					timestamp: new Date().toISOString(),
				}),
		}),
	],
	mode: 'ssr',
});

const dev = await createDevHandler(app, { root, template: 'index.ssr.html' });
serve(dev.fetch, { port: 5175, middleware: dev.middleware }).listen();
