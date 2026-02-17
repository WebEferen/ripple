/**
 * @param {{ fetch: (request: Request, platform?: any) => Promise<Response> }} app
 * @param {{ template: string }} options
 * @returns {{ fetch: (request: Request, platform?: any) => Promise<Response> }}
 */
export function create_prod_handler(app, options) {
	const template = options.template;

	return {
		fetch(request, platform) {
			return app.fetch(request, { ...platform, template });
		},
	};
}

export { create_prod_handler as createProdHandler };
