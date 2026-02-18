/**
 * @typedef {'ssr-pre-render' | 'ssr-stream' | 'ssr-complete' | 'client-only'} DeliveryMode
 *
 * @typedef {(
 * 	context: any,
 * 	next: () => Promise<Response>,
 * ) => Promise<Response>} Middleware
 *
 * @typedef {{
 * 	path: string,
 * 	entry: any | string,
 * 	deliveryMode?: DeliveryMode,
 * 	disableHydration?: boolean,
 * 	server?: { before?: Middleware[], after?: Middleware[] },
 * }} RenderRouteInit
 *
 * @typedef {{
 * 	path: string,
 * 	methods?: string[],
 * 	handler: (context: any) => Response | Promise<Response>,
 * 	before?: Middleware[],
 * 	after?: Middleware[],
 * }} ServerRouteInit
 *
 * @typedef {RenderRoute | ServerRoute} Route
 *
 * @typedef {{
 * 	type: 'match',
 * 	route: Route,
 * 	url: URL,
 * 	params: Record<string, string>,
 * }} MatchResult
 *
 * @typedef {{
 * 	type: 'method_not_allowed',
 * 	url: URL,
 * 	allowed_methods: string[],
 * }} MethodNotAllowedResult
 *
 * @typedef {{ type: 'not_found', url: URL }} NotFoundResult
 *
 * @typedef {MatchResult | MethodNotAllowedResult | NotFoundResult} RouteMatchResult
 */

/**
 * @param {string} pathname
 * @returns {string}
 */
function normalize_pathname(pathname) {
	if (pathname === '/') return '/';
	if (pathname.endsWith('/')) return pathname.slice(0, -1);
	return pathname;
}

/**
 * @param {string} path
 * @returns {string}
 */
function normalize_route_path(path) {
	if (path === '') return '/';
	if (!path.startsWith('/')) return `/${path}`;
	return path;
}

/**
 * @typedef {{ type: 'static', value: string } | { type: 'param', name: string }} Segment
 */

/**
 * @param {string} route_path
 * @returns {{ route_path: string, segments: Segment[] }}
 */
function compile_route_path(route_path) {
	const normalized_route_path = normalize_route_path(route_path);
	const normalized_pathname = normalize_pathname(normalized_route_path);

	if (normalized_pathname === '/') {
		return {
			route_path: normalized_pathname,
			segments: [],
		};
	}

	const parts = normalized_pathname.split('/').filter(Boolean);
	/** @type {Segment[]} */
	const segments = [];

	for (const part of parts) {
		if (part.startsWith(':')) {
			const name = part.slice(1);
			if (name.length === 0) {
				throw new Error(`Invalid route param in path: ${route_path}`);
			}
			segments.push({ type: 'param', name });
		} else {
			segments.push({ type: 'static', value: part });
		}
	}

	return {
		route_path: normalized_pathname,
		segments,
	};
}

/**
 * @param {{ segments: Segment[] }} compiled
 * @param {string} pathname
 * @returns {Record<string, string> | null}
 */
function match_compiled_path(compiled, pathname) {
	const normalized_pathname = normalize_pathname(pathname);

	if (compiled.segments.length === 0) {
		return normalized_pathname === '/' ? {} : null;
	}

	const parts = normalized_pathname.split('/').filter(Boolean);
	if (parts.length !== compiled.segments.length) return null;

	/** @type {Record<string, string>} */
	const params = {};

	for (let i = 0; i < compiled.segments.length; i++) {
		const segment = compiled.segments[i];
		const part = parts[i];

		if (segment.type === 'static') {
			if (segment.value !== part) return null;
		} else {
			try {
				params[segment.name] = decodeURIComponent(part);
			} catch {
				return null;
			}
		}
	}

	return params;
}

/**
 * @param {unknown} value
 * @returns {value is RenderRoute}
 */
export function is_render_route(value) {
	return value instanceof RenderRoute;
}

/**
 * @param {unknown} value
 * @returns {value is ServerRoute}
 */
export function is_server_route(value) {
	return value instanceof ServerRoute;
}

export class RenderRoute {
	/**
	 * @param {RenderRouteInit} init
	 */
	constructor(init) {
		this.type = 'render';
		this.path = normalize_route_path(init.path);
		this.entry = init.entry;
		this.delivery_mode = init.deliveryMode ?? 'ssr-complete';
		this.disable_hydration = init.disableHydration ?? false;
		this.server = init.server ?? {};
		this.compiled_path = compile_route_path(this.path);
	}

	/**
	 * @param {URL} url
	 * @returns {Record<string, string> | null}
	 */
	match(url) {
		return match_compiled_path(this.compiled_path, url.pathname);
	}
}

export class ServerRoute {
	/**
	 * @param {ServerRouteInit} init
	 */
	constructor(init) {
		this.type = 'server';
		this.path = normalize_route_path(init.path);
		this.methods = init.methods == null ? null : init.methods.map((m) => m.toUpperCase());
		this.handler = init.handler;
		this.before = init.before ?? [];
		this.after = init.after ?? [];
		this.compiled_path = compile_route_path(this.path);
	}

	/**
	 * @param {URL} url
	 * @returns {Record<string, string> | null}
	 */
	match(url) {
		return match_compiled_path(this.compiled_path, url.pathname);
	}

	/**
	 * @param {string} method
	 * @returns {boolean}
	 */
	allows_method(method) {
		if (this.methods == null) return true;
		return this.methods.includes(method.toUpperCase());
	}
}

/**
 * Matches a request to a route.
 *
 * - Order matters: the first route that matches path (and method where relevant) wins.\n
 * - For GET/HEAD requests, `RenderRoute` is considered a valid match.\n
 * - For non-GET/HEAD, `RenderRoute` contributes to 405 handling, but does not match.\n
 *
 * @param {Route[]} routes
 * @param {Request} request
 * @returns {RouteMatchResult}
 */
export function match_route(routes, request) {
	const url = new URL(request.url);
	const method = request.method.toUpperCase();

	/** @type {Set<string>} */
	const allowed_methods = new Set();

	for (const route of routes) {
		const params = route.match(url);
		if (params == null) continue;

		if (route.type === 'server') {
			if (route.methods == null) {
				return { type: 'match', route, url, params };
			}
			for (const allowed_method of route.methods) {
				allowed_methods.add(allowed_method);
			}
			if (route.allows_method(method)) {
				return { type: 'match', route, url, params };
			}
			continue;
		}

		allowed_methods.add('GET');
		allowed_methods.add('HEAD');

		if (method === 'GET' || method === 'HEAD') {
			return { type: 'match', route, url, params };
		}
	}

	if (allowed_methods.size > 0) {
		return { type: 'method_not_allowed', url, allowed_methods: [...allowed_methods] };
	}

	return { type: 'not_found', url };
}

export {
	is_render_route as isRenderRoute,
	is_server_route as isServerRoute,
	match_route as matchRoute,
};
