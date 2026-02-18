import { describe, expect, it } from 'vitest';
import { createApp } from '../../../meta/src/index.js';
import { RenderRoute } from '../../../meta/src/routing/index.js';

const template =
	'<html><head><!--ssr-head--></head><body><div id="root"><!--ssr-body--></div></body></html>';

function create_component(text = 'Meta SSR OK') {
	return (output) => {
		output.push(`<div>${text}</div>`);
	};
}

async function fetch_html(app) {
	const response = await app.fetch(new Request('http://example.com/', { method: 'GET' }), {
		template,
	});
	return await response.text();
}

describe('@ripple-ts/meta app rendering', () => {
	it('includes hydration markers in hybrid mode by default', async () => {
		const app = createApp({
			mode: 'hybrid',
			routes: [new RenderRoute({ path: '/', entry: create_component() })],
		});
		const html = await fetch_html(app);

		expect(html).toContain('<!--[-->');
		expect(html).toContain('<!--]-->');
		expect(html).toContain('<div>Meta SSR OK</div>');
	});

	it('strips hydration markers in ssr mode by default', async () => {
		const app = createApp({
			mode: 'ssr',
			routes: [new RenderRoute({ path: '/', entry: create_component() })],
		});
		const html = await fetch_html(app);

		expect(html).not.toContain('<!--[-->');
		expect(html).not.toContain('<!--]-->');
		expect(html).toContain('<div>Meta SSR OK</div>');
	});

	it('can re-enable hydration markers in ssr mode with disableHydration: false', async () => {
		const app = createApp({
			mode: 'ssr',
			disableHydration: false,
			routes: [new RenderRoute({ path: '/', entry: create_component() })],
		});
		const html = await fetch_html(app);

		expect(html).toContain('<!--[-->');
		expect(html).toContain('<!--]-->');
	});

	it('supports route-level disableHydration in hybrid mode', async () => {
		const app = createApp({
			mode: 'hybrid',
			routes: [
				new RenderRoute({
					path: '/',
					entry: create_component(),
					disableHydration: true,
				}),
			],
		});
		const html = await fetch_html(app);

		expect(html).not.toContain('<!--[-->');
		expect(html).not.toContain('<!--]-->');
		expect(html).toContain('<div>Meta SSR OK</div>');
	});

	it('resolves string route entries with platform.load_module()', async () => {
		const app = createApp({
			mode: 'hybrid',
			routes: [new RenderRoute({ path: '/', entry: '/virtual/App.ripple' })],
		});

		const response = await app.fetch(new Request('http://example.com/', { method: 'GET' }), {
			template,
			load_module: async (id) => {
				if (id !== '/virtual/App.ripple') {
					throw new Error('unexpected module id');
				}
				return { App: create_component('Loaded from module path') };
			},
		});
		const html = await response.text();

		expect(html).toContain('Loaded from module path');
		expect(html).toContain('<!--[-->');
	});

	it('throws when string route entry has no loader in platform', async () => {
		const app = createApp({
			mode: 'hybrid',
			routes: [new RenderRoute({ path: '/', entry: '/virtual/App.ripple' })],
		});

		await expect(
			app.fetch(new Request('http://example.com/', { method: 'GET' }), { template }),
		).rejects.toThrow('requires platform.vite.ssrLoadModule() or platform.load_module().');
	});
});
