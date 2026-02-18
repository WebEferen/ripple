/**
 * @param {any} context
 * @param {() => Promise<Response>} next
 * @returns {Promise<Response>}
 */
export async function logging_middleware(context, next) {
	const start = performance.now();
	const response = await next();
	const duration = Math.round((performance.now() - start) * 100) / 100;
	console.log(
		`[meta] ${context.request.method} ${context.url.pathname} -> ${response.status} (${duration}ms)`,
	);
	return response;
}

export const compound_logging_middleware = (message) => (_, next) => {
	console.log(`[custom handler] ${message}`);

	return next();
};
