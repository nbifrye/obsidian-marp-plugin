// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
	isDangerousUrl,
	mediaUrls,
	parseHtml,
	resolveMediaUrls,
	sanitizeFragment,
} from '../../src/render/sanitize';

function sanitize(html: string): string {
	const body = parseHtml(html);
	sanitizeFragment(body);
	return body.innerHTML;
}

describe('sanitizeFragment', () => {
	it.each([
		'<script>alert(1)</script>',
		'<iframe src="https://example.com"></iframe>',
		'<object data="x.swf"></object>',
		'<embed src="x">',
		'<meta http-equiv="refresh" content="0;url=https://example.com">',
		'<base href="https://example.com/">',
		'<link rel="prefetch" href="https://example.com">',
	])('removes %s', (html) => {
		expect(sanitize(`<p>ok</p>${html}`)).toBe('<p>ok</p>');
	});

	it('also sanitizes leading metadata elements', () => {
		expect(
			sanitize(
				'<meta http-equiv="refresh" content="0"><style>p{}</style><p>ok</p>',
			),
		).toBe('<style>p{}</style><p>ok</p>');
	});

	it('removes SVG animation that could set links', () => {
		expect(
			sanitize(
				'<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>',
			),
		).toBe('<svg></svg>');
	});

	it('removes event handlers, targets and dangerous URLs', () => {
		const html = sanitize(
			'<img src="a.png" onerror="alert(1)"><a href=" java\tscript:alert(1)" target="_top">x</a><a href="data:text/html,x">y</a><form action="https://example.com"><button formaction="javascript:x">b</button></form>',
		);
		expect(html).not.toMatch(
			/onerror|javascript|target|data:text|action=/i,
		);
		expect(html).toContain('src="a.png"');
	});

	it('keeps safe content', () => {
		const safe =
			'<a href="https://example.com">a</a><img src="data:image/png;base64,AA=="><link rel="stylesheet" href="https://example.com/a.css"><span style="color:red">x</span>';
		expect(sanitize(safe)).toBe(safe);
	});
});

describe('isDangerousUrl', () => {
	it.each([
		['javascript:alert(1)', true],
		['JaVaScRiPt:x', true],
		['vbscript:x', true],
		['data:text/html,x', true],
		['data:image/svg+xml;base64,AA', false],
		['https://example.com', false],
		['images/a.png', false],
		['#2', false],
	])('%s → %s', (url, expected) => {
		expect(isDangerousUrl(url)).toBe(expected);
	});
});

describe('resolveMediaUrls', () => {
	it('rewrites relative media URLs only', () => {
		const body = parseHtml(
			'<img src="a.png"><img src="https://example.com/b.png"><video src="v.mp4" poster="p.png"></video>',
		);
		expect(mediaUrls(body)).toEqual(['a.png', 'v.mp4', 'p.png']);
		resolveMediaUrls(body, (url) => `app://vault/${url}`);
		const imgs = body.querySelectorAll('img');
		expect(imgs[0]?.getAttribute('src')).toBe('app://vault/a.png');
		expect(imgs[1]?.getAttribute('src')).toBe('https://example.com/b.png');
		expect(body.querySelector('video')?.getAttribute('poster')).toBe(
			'app://vault/p.png',
		);
	});
});
