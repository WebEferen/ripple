import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createServer as create_vite_server } from 'vite';

/**
 * @typedef {{
 * 	root?: string,
 * 	template?: string,
 * 	vite?: Parameters<typeof create_vite_server>[0],
 * }} DevHandlerOptions
 */

/**
 * @param {{ fetch: (request: Request, platform?: any) => Promise<Response> }} app
 * @param {DevHandlerOptions} [options]
 * @returns {Promise<{ vite: import('vite').ViteDevServer, middleware: any, fetch: (request: Request, platform?: any) => Promise<Response>, close: () => Promise<void> }>}
 */
export async function create_dev_handler(app, options = {}) {
	const root = options.root ?? process.cwd();
	const template_path = resolve(root, options.template ?? 'index.html');

	const vite = await create_vite_server({
		root,
		server: { middlewareMode: true },
		appType: 'custom',
		...(options.vite ?? {}),
	});

	return {
		vite,
		middleware: vite.middlewares,
		async fetch(request, platform) {
			const url = new URL(request.url);
			const raw_template = await readFile(template_path, 'utf-8');
			const template = await vite.transformIndexHtml(url.pathname, raw_template);
			return await app.fetch(request, { ...platform, vite, template });
		},
		close() {
			return vite.close();
		},
	};
}

export { create_dev_handler as createDevHandler };
