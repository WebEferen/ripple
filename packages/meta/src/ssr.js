const HYDRATION_MARKERS = /<!--\[!-->|<!--\[-->|<!--\]-->/g;

/**
 * @param {string} css_text
 * @returns {string}
 */
export function css_to_style_tag(css_text) {
	if (css_text.length === 0) return '';
	return `<style id="ripple-css">${css_text}</style>`;
}

/**
 * @param {string} template
 * @param {{ head: string, body: string, css_text: string }} ssr
 * @returns {string}
 */
export function inject_ssr(template, ssr) {
	const head_injection = ssr.head + css_to_style_tag(ssr.css_text);

	let html = template;

	if (html.includes('<!--ssr-head-->')) {
		html = html.replace('<!--ssr-head-->', head_injection);
	} else if (html.includes('</head>')) {
		html = html.replace('</head>', head_injection + '</head>');
	}

	if (html.includes('<!--ssr-body-->')) {
		html = html.replace('<!--ssr-body-->', ssr.body);
	} else if (html.includes('</body>')) {
		html = html.replace('</body>', ssr.body + '</body>');
	}

	return html;
}

/**
 * Removes Ripple hydration markers from SSR output.
 * Useful for SSR-only responses that should mount on the client instead of hydrate.
 * @param {string} html
 * @returns {string}
 */
export function strip_hydration_markers(html) {
	return html.replace(HYDRATION_MARKERS, '');
}

/**
 * @param {string} html
 * @param {number} [status]
 * @param {HeadersInit} [headers_init]
 * @returns {Response}
 */
export function html_response(html, status = 200, headers_init) {
	const headers = new Headers(headers_init);
	if (!headers.has('content-type')) {
		headers.set('content-type', 'text/html; charset=utf-8');
	}
	return new Response(html, { status, headers });
}
