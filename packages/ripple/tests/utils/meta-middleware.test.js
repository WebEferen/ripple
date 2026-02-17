import { describe, it, expect } from 'vitest';
import { composeMiddleware } from '../../../meta/src/index.js';

describe('@ripple-ts/meta middleware', () => {
	it('composes middleware in Koa order', async () => {
		const steps = [];

		const a = async (context, next) => {
			steps.push('a:before');
			const response = await next();
			steps.push('a:after');
			return response;
		};

		const b = async (context, next) => {
			steps.push('b:before');
			const response = await next();
			steps.push('b:after');
			return response;
		};

		const handler = async () => {
			steps.push('handler');
			return new Response('ok');
		};

		const response = await composeMiddleware([a, b], handler)({});
		expect(await response.text()).toBe('ok');
		expect(steps).toEqual(['a:before', 'b:before', 'handler', 'b:after', 'a:after']);
	});
});
