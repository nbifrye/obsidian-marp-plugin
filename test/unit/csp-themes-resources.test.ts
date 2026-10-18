import { describe, expect, it } from 'vitest';
import { buildCsp, sha256Base64 } from '../../src/render/csp';
import { joinPath, parentFolder } from '../../src/render/resources';
import { cssUrls, isThemeFile, rewriteCssUrls } from '../../src/render/themes';

describe('buildCsp', () => {
	it('blocks scripts, frames, plugins, base and forms', () => {
		const csp = buildCsp({
			blockExternalResources: false,
			resourceOrigin: 'app://x',
		});
		for (const directive of [
			"script-src 'none'",
			"object-src 'none'",
			"frame-src 'none'",
			"base-uri 'none'",
			"form-action 'none'",
			"connect-src 'none'",
		]) {
			expect(csp).toContain(directive);
		}
		expect(csp).toContain('img-src data: blob: app://x https: http:');
	});

	it('allows only local sources when external resources are blocked', () => {
		const csp = buildCsp({
			blockExternalResources: true,
			resourceOrigin: 'app://x',
		});
		expect(csp).not.toMatch(/https?:/);
		expect(csp).toContain('font-src data: blob: app://x');
	});

	it('allows hashed scripts', async () => {
		const hash = await sha256Base64('a');
		expect(hash).toBe(
			'sha256-ypeBEsobvcr6wjGzmiPcTaeG7/gUfE5yuYB3ha/uSLs=',
		);
		expect(
			buildCsp({
				blockExternalResources: true,
				resourceOrigin: '',
				scriptHashes: [hash],
			}),
		).toContain(`script-src '${hash}'`);
	});
});

describe('theme CSS URLs', () => {
	const css = `/* @theme t */
@import url('local.css');
@import 'https://fonts.example.com/a.css';
section { background: url(bg.png); }
@font-face { src: url("../fonts/a.woff2") format("woff2"); }
h1 { background: url(https://example.com/x.png), url(data:image/png;base64,AA); }`;

	it('lists only vault-relative URLs outside @import', () => {
		expect(cssUrls(css)).toEqual(['bg.png', '../fonts/a.woff2']);
	});

	it('rewrites them', () => {
		const out = rewriteCssUrls(css, (url) => `app://vault/${url}`);
		expect(out).toContain('url("app://vault/bg.png")');
		expect(out).toContain('url("app://vault/../fonts/a.woff2")');
		expect(out).toContain("@import url('local.css')");
		expect(out).toContain('url(https://example.com/x.png)');
	});

	it('detects theme files in the folder', () => {
		expect(isThemeFile('Themes/a.css', 'Themes')).toBe(true);
		expect(isThemeFile('Themes/sub/a.CSS', 'Themes/')).toBe(true);
		expect(isThemeFile('Themes.css', 'Themes')).toBe(false);
		expect(isThemeFile('a.css', '')).toBe(false);
	});
});

describe('paths', () => {
	it('joins relative paths', () => {
		expect(joinPath('a/b', '../c/./d.png')).toBe('a/c/d.png');
		expect(joinPath('', 'x.png')).toBe('x.png');
		expect(parentFolder('a/b/c.md')).toBe('a/b');
		expect(parentFolder('c.md')).toBe('');
	});
});
