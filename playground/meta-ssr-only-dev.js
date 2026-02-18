import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { serve } from '../packages/adapter-node/src/index.js';
import { createApp } from '../packages/meta/src/index.js';
import { createDevHandler } from '../packages/meta/src/dev/index.js';
import { RenderRoute, ServerRoute } from '../packages/meta/src/routing/index.js';
import { compound_logging_middleware, logging_middleware } from './meta-logging-middleware.js';

const root = dirname(fileURLToPath(import.meta.url));

const app = createApp({
	routes: [
		new RenderRoute({ path: '/', entry: '/src/MetaApp.ripple' }),
		new ServerRoute({
			path: '/api/hello',
			methods: ['GET'],
			before: [compound_logging_middleware('before api call')],
			after: [compound_logging_middleware('after api call')],
			handler: async () => {
				console.log('[handler] inside handler');

				return Response.json({
					message: 'Hello from Meta SSR (hydration demo)',
					timestamp: new Date().toISOString(),
				});
			},
		}),
	],
	mode: 'ssr',
});

app.use(logging_middleware);

const dev = await createDevHandler(app, { root, template: 'index.ssr.html' });
serve(dev.fetch, { port: 5175, middleware: dev.middleware }).listen();
