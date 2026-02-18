export type DeliveryMode = 'ssr-pre-render' | 'ssr-stream' | 'ssr-complete' | 'client-only';

export type Middleware<Context = any> = (
	context: Context,
	next: () => Promise<Response>,
) => Promise<Response>;

export type RenderRouteInit = {
	path: string;
	entry: any | string;
	deliveryMode?: DeliveryMode;
	disableHydration?: boolean;
	server?: {
		before?: Middleware[];
		after?: Middleware[];
	};
};

export type ServerRouteInit = {
	path: string;
	methods?: string[];
	handler: (context: Context) => Response | Promise<Response>;
	before?: Middleware[];
	after?: Middleware[];
};

export type Route = RenderRoute | ServerRoute;

export type MatchResult = {
	type: 'match';
	route: Route;
	url: URL;
	params: Record<string, string>;
};

export type MethodNotAllowedResult = {
	type: 'method_not_allowed';
	url: URL;
	allowed_methods: string[];
};

export type NotFoundResult = {
	type: 'not_found';
	url: URL;
};

export type RouteMatchResult = MatchResult | MethodNotAllowedResult | NotFoundResult;

export class RenderRoute {
	constructor(init: RenderRouteInit);
	readonly type: 'render';
	readonly path: string;
	readonly entry: any | string;
	readonly delivery_mode: DeliveryMode;
	readonly disable_hydration: boolean;
	readonly server: {
		before?: Middleware[];
		after?: Middleware[];
	};
	match(url: URL): Record<string, string> | null;
}

export class ServerRoute {
	constructor(init: ServerRouteInit);
	readonly type: 'server';
	readonly path: string;
	readonly methods: string[] | null;
	readonly handler: (context: Context) => Response | Promise<Response>;
	readonly before: Middleware[];
	readonly after: Middleware[];
	match(url: URL): Record<string, string> | null;
	allows_method(method: string): boolean;
}

export function isRenderRoute(value: unknown): value is RenderRoute;
export function isServerRoute(value: unknown): value is ServerRoute;
export function matchRoute(routes: Route[], request: Request): RouteMatchResult;

export type Context = any;
