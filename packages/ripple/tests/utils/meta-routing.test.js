import { describe, it, expect } from 'vitest';
import { RenderRoute, ServerRoute, matchRoute } from '../../../meta/src/routing/index.js';

describe('@ripple-ts/meta routing', () => {
	it('matches render routes and extracts params', () => {
		const routes = [
			new RenderRoute({
				path: '/blog/:slug',
				entry: () => {},
			}),
		];

		const request = new Request('http://example.com/blog/hello-world', { method: 'GET' });
		const result = matchRoute(routes, request);

		expect(result.type).toBe('match');
		if (result.type !== 'match') return;
		expect(result.params).toEqual({ slug: 'hello-world' });
	});

	it('returns method_not_allowed for mismatched server methods', () => {
		const routes = [
			new ServerRoute({
				path: '/api/user/:id',
				methods: ['POST'],
				handler: async () => new Response('ok'),
			}),
		];

		const request = new Request('http://example.com/api/user/123', { method: 'GET' });
		const result = matchRoute(routes, request);

		expect(result.type).toBe('method_not_allowed');
		if (result.type !== 'method_not_allowed') return;
		expect(result.allowed_methods).toEqual(['POST']);
	});
});
