import { describe, it, expect } from 'vitest';
import { inject_ssr } from '../../../meta/src/ssr.js';

describe('@ripple-ts/meta ssr injection', () => {
	it('injects head, css, and body markers', () => {
		const template = '<html><head><!--ssr-head--></head><body><!--ssr-body--></body></html>';
		const html = inject_ssr(template, {
			head: '<title>Test</title>',
			body: '<div>Body</div>',
			css_text: '.x{color:red}',
		});

		expect(html).toContain('<title>Test</title>');
		expect(html).toContain('<style id="ripple-css">.x{color:red}</style>');
		expect(html).toContain('<div>Body</div>');
	});
});
