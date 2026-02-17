/**
 * @template Context
 * @param {Array<(context: Context, next: () => Promise<Response>) => Promise<Response>>} middlewares
 * @param {(context: Context) => Promise<Response>} handler
 * @returns {(context: Context) => Promise<Response>}
 */
export function compose_middleware(middlewares, handler) {
	return async function composed(context) {
		let last_index = -1;

		/**
		 * @param {number} index
		 * @returns {Promise<Response>}
		 */
		async function dispatch(index) {
			if (index <= last_index) {
				throw new Error('next() called multiple times');
			}

			last_index = index;

			const fn = index === middlewares.length ? handler : middlewares[index];
			if (fn == null) {
				throw new Error('Middleware dispatch reached invalid handler');
			}

			return await fn(context, () => dispatch(index + 1));
		}

		return await dispatch(0);
	};
}

export { compose_middleware as composeMiddleware };
