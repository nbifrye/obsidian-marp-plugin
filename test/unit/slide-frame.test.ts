// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseHtml } from '../../src/render/sanitize';
import { linkOf } from '../../src/ui/slide-frame';

describe('linkOf', () => {
	const body = parseHtml(
		'<a href="#2"><span id="in-a">x</span></a>' +
			'<map name="m"><area id="area" shape="default" href="https://example.com"></map>' +
			'<svg><a href="#3"><text id="in-svg-a">y</text></a></svg>' +
			'<p id="plain">z</p>',
	);
	const byId = (id: string) => body.querySelector(`#${id}`);

	it('finds HTML, SVG and image map links', () => {
		expect(linkOf(byId('in-a'))?.getAttribute('href')).toBe('#2');
		expect(linkOf(byId('area'))?.getAttribute('href')).toBe(
			'https://example.com',
		);
		expect(linkOf(byId('in-svg-a'))?.getAttribute('href')).toBe('#3');
	});

	it('returns null outside links', () => {
		expect(linkOf(byId('plain'))).toBeNull();
		expect(linkOf(null)).toBeNull();
	});
});
