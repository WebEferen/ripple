import { defineConfig } from '@ripple-ts/meta';
import { serve } from '@ripple-ts/adapter-node';
import { routes } from './src/routes.js';
import { loggingMiddleware } from './src/middleware.js';

export default defineConfig({
	mode: 'hybrid',
	port: 3000,
	adapter: { serve },
	routes,
	app: {
		middlewares: [loggingMiddleware],
	},
});
