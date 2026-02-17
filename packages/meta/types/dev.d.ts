import type { ViteDevServer, UserConfig } from 'vite';

export type DevHandlerOptions = {
	root?: string;
	template?: string;
	vite?: UserConfig;
};

export function createDevHandler(
	app: { fetch: (request: Request, platform?: any) => Promise<Response> },
	options?: DevHandlerOptions,
): Promise<{
	vite: ViteDevServer;
	middleware: any;
	fetch: (request: Request, platform?: any) => Promise<Response>;
	close: () => Promise<void>;
}>;

export const create_dev_handler: typeof createDevHandler;
