import { get_css_for_hashes, render } from 'ripple/server';

import { compose_middleware } from './middleware.js';
import { match_route, RenderRoute, ServerRoute } from './routing/index.js';
import { html_response, inject_ssr } from './ssr.js';

/**
 * @typedef {'client' | 'ssr' | 'hybrid'} AppMode
 *
 * @typedef {{
 * 	routes: import('./routing/index.js').Route[],
 * 	mode?: AppMode,
 * 	disableHydration?: boolean,
 * 	template?: string | ((url: URL) => string | Promise<string>),
 * }} CreateAppOptions
 */

/**
 * @template T
 * @param {T} config
 * @returns {T}
 */
export function defineConfig(config) {
	return config;
}

/**
 * @param {CreateAppOptions} options
 * @returns {{
 * 	use: (middleware: (context: any, next: () => Promise<Response>) => Promise<Response>) => void,
 * 	fetch: (request: Request, platform?: any) => Promise<Response>,
 * }}
 */
export function createApp(options) {
	const routes = options.routes;
	const mode = options.mode ?? 'hybrid';

	/** @type {Array<(context: any, next: () => Promise<Response>) => Promise<Response>>} */
	const app_middlewares = [];

	/**
	 * @param {URL} url
	 * @param {any} platform
	 * @returns {Promise<string>}
	 */
	async function load_template(url, platform) {
		if (typeof options.template === 'function') {
			return await options.template(url);
		}
		if (typeof options.template === 'string') {
			return options.template;
		}
		if (typeof platform?.template === 'string') {
			return platform.template;
		}
		if (typeof platform?.load_template === 'function') {
			return await platform.load_template(url);
		}
		throw new Error(
			'createApp requires options.template or platform.template/platform.load_template',
		);
	}

	/**
	 * @param {Request} request
	 * @param {any} platform
	 * @returns {Promise<Response>}
	 */
	async function fetch(request, platform) {
		const match = match_route(routes, request);

		if (match.type === 'method_not_allowed') {
			return new Response('Method Not Allowed', {
				status: 405,
				headers: { Allow: match.allowed_methods.join(', ') },
			});
		}

		if (match.type === 'not_found') {
			return new Response('Not Found', { status: 404 });
		}

		const state = new Map();
		const app = {
			routes,
			middlewares: app_middlewares,
			platform,
			config: options,
		};

		const context = {
			app,
			request,
			url: match.url,
			params: match.params,
			state,
			platform,
			route: match.route,
		};

		/** @type {Array<(context: any, next: () => Promise<Response>) => Promise<Response>>} */
		const middlewares = [...app_middlewares];

		if (match.route instanceof ServerRoute) {
			const server_route = /** @type {any} */ (match.route);
			middlewares.push(...server_route.before);
			for (let i = server_route.after.length - 1; i >= 0; i--) {
				const after = server_route.after[i];
				middlewares.push(async (ctx, next) => {
					const response = await next();
					let called = false;
					return await after(ctx, async () => {
						if (called) throw new Error('next() called multiple times');
						called = true;
						return response;
					});
				});
			}

			const handler = async () => await server_route.handler(context);
			return await compose_middleware(middlewares, handler)(context);
		}

		const render_route = /** @type {RenderRoute} */ (match.route);

		if (mode === 'client' || render_route.delivery_mode === 'client-only') {
			const template = await load_template(match.url, platform);
			return html_response(template);
		}

		middlewares.push(...(render_route.server?.before ?? []));
		const template = await load_template(match.url, platform);

		const handler = async () => {
			const entry = render_route.entry;
			const component = entry?.component ?? entry;
			const result = await render(component);
			const css_text = get_css_for_hashes(result.css);
			const html = inject_ssr(template, { head: result.head, body: result.body, css_text });
			return html_response(html);
		};

		const after_middlewares = render_route.server?.after ?? [];
		for (let i = after_middlewares.length - 1; i >= 0; i--) {
			const after = after_middlewares[i];
			middlewares.push(async (ctx, next) => {
				const response = await next();
				let called = false;
				return await after(ctx, async () => {
					if (called) throw new Error('next() called multiple times');
					called = true;
					return response;
				});
			});
		}

		return await compose_middleware(middlewares, handler)(context);
	}

	return {
		use(middleware) {
			app_middlewares.push(middleware);
		},
		fetch,
	};
}
