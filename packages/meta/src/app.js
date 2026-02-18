import { get_css_for_hashes, render } from 'ripple/server';

import { compose_middleware } from './middleware.js';
import { match_route, RenderRoute, ServerRoute } from './routing/index.js';
import { html_response, inject_ssr, strip_hydration_markers } from './ssr.js';

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
 * @param {any} resolved_entry
 * @returns {any}
 */
function pick_component_export(resolved_entry) {
	const component =
		resolved_entry?.component ?? resolved_entry?.default ?? resolved_entry?.App ?? resolved_entry;

	if (typeof component === 'function') {
		return component;
	}

	if (resolved_entry && typeof resolved_entry === 'object') {
		const functions = Object.values(resolved_entry).filter((value) => typeof value === 'function');
		if (functions.length === 1) {
			return functions[0];
		}
	}

	return component;
}

/**
 * @param {any} platform
 * @returns {Promise<{ render: typeof render, get_css_for_hashes: typeof get_css_for_hashes }>}
 */
async function resolve_server_runtime(platform) {
	if (typeof platform?.vite?.ssrLoadModule === 'function') {
		try {
			const runtime = await platform.vite.ssrLoadModule('ripple/server');
			if (
				typeof runtime?.render === 'function' &&
				typeof runtime?.get_css_for_hashes === 'function'
			) {
				return {
					render: runtime.render,
					get_css_for_hashes: runtime.get_css_for_hashes,
				};
			}
		} catch {}
	}

	if (typeof platform?.load_module === 'function') {
		try {
			const runtime = await platform.load_module('ripple/server');
			if (
				typeof runtime?.render === 'function' &&
				typeof runtime?.get_css_for_hashes === 'function'
			) {
				return {
					render: runtime.render,
					get_css_for_hashes: runtime.get_css_for_hashes,
				};
			}
		} catch {}
	}

	return { render, get_css_for_hashes };
}

/**
 * @param {any} entry
 * @param {any} platform
 * @returns {Promise<{ component: any, render: typeof render, get_css_for_hashes: typeof get_css_for_hashes }>}
 */
async function resolve_route_component(entry, platform) {
	let resolved_entry = entry;
	let server_runtime = { render, get_css_for_hashes };

	if (typeof entry === 'string') {
		if (typeof platform?.vite?.ssrLoadModule === 'function') {
			resolved_entry = await platform.vite.ssrLoadModule(entry);
			server_runtime = await resolve_server_runtime(platform);
		} else if (typeof platform?.load_module === 'function') {
			resolved_entry = await platform.load_module(entry);
			server_runtime = await resolve_server_runtime(platform);
		} else {
			throw new Error(
				`RenderRoute entry "${entry}" requires platform.vite.ssrLoadModule() or platform.load_module().`,
			);
		}
	}

	const component = pick_component_export(resolved_entry);
	if (typeof component !== 'function') {
		throw new Error('RenderRoute entry did not resolve to a component function.');
	}
	return { component, ...server_runtime };
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
	const app_disable_hydration = options.disableHydration ?? mode === 'ssr';

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
			const route = await resolve_route_component(render_route.entry, platform);
			const result = await route.render(route.component);
			const css_text = route.get_css_for_hashes(result.css);
			const disable_hydration = app_disable_hydration || render_route.disable_hydration;
			const body = disable_hydration ? strip_hydration_markers(result.body) : result.body;
			const html = inject_ssr(template, { head: result.head, body, css_text });
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
