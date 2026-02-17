import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { serve } from '../packages/adapter-node/src/index.js';
import { createApp } from '../packages/meta/src/index.js';
import { createDevHandler } from '../packages/meta/src/dev/index.js';
import { RenderRoute } from '../packages/meta/src/routing/index.js';

const root = dirname(fileURLToPath(import.meta.url));

const App = (output) => {
	output.push('<div>Meta SSR OK</div>');
};

const app = createApp({
	routes: [new RenderRoute({ path: '/', entry: App })],
	mode: 'ssr',
});

const dev = await createDevHandler(app, { root, template: 'index.html' });
serve(dev.fetch, { port: 5174, middleware: dev.middleware }).listen();
