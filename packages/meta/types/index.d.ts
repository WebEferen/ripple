export * from './routing';

export function composeMiddleware<Context = any>(
	middlewares: Array<(context: Context, next: () => Promise<Response>) => Promise<Response>>,
	handler: (context: Context) => Promise<Response>,
): (context: Context) => Promise<Response>;

export const compose_middleware: typeof composeMiddleware;

export type AppMode = 'client' | 'ssr' | 'hybrid';

export type CreateAppOptions = {
	routes: Array<RenderRoute | ServerRoute>;
	mode?: AppMode;
	disableHydration?: boolean;
	template?: string | ((url: URL) => string | Promise<string>);
};

export function defineConfig<T>(config: T): T;

export function createApp(options: CreateAppOptions): {
	use: (middleware: Middleware) => void;
	fetch: (request: Request, platform?: any) => Promise<Response>;
};

export function createProdHandler(
	app: { fetch: (request: Request, platform?: any) => Promise<Response> },
	options: { template: string },
): {
	fetch: (request: Request, platform?: any) => Promise<Response>;
};

export const create_prod_handler: typeof createProdHandler;
