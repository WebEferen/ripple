export async function loggingMiddleware(context, next) {
	const response = await next();
	return response;
}
