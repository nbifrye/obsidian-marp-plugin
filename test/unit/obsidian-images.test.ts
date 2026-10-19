import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/render/engine';
import type { RenderEnv } from '../../src/render/obsidian-images';

const engine = createEngine({ math: 'mathjax', html: 'allowlist', themes: [] });
const calls: [string, string][] = [];
const env: RenderEnv = {
	resolveUrl: (url, kind) => {
		calls.push([url, kind]);
		return `app://vault/${url}`;
	},
};
const render = (body: string) => {
	calls.length = 0;
	return engine.render(`---\nmarp: true\n---\n\n${body}\n`, env).html;
};

describe('Obsidian image references', () => {
	it('resolves relative Markdown images', () => {
		const html = render('![](images/a.png)');
		expect(calls).toEqual([['images/a.png', 'link']]);
		expect(html).toContain('src="app://vault/images/a.png"');
	});

	it('turns embeds into images with Marp size options', () => {
		const html = render('![[a.png|300]] ![[b.png|300x200]]');
		expect(calls).toEqual([
			['a.png', 'embed'],
			['b.png', 'embed'],
		]);
		expect(html).toMatch(/<img src="app:\/\/vault\/a.png"[^>]*width:300px/);
		expect(html).toMatch(
			/<img src="app:\/\/vault\/b.png"[^>]*height:200px/,
		);
	});

	it('passes other embed options to Marp, e.g. backgrounds', () => {
		const html = render('![[bg.png|bg]]');
		expect(html).toContain(
			'background-image:url(&quot;app://vault/bg.png&quot;)',
		);
	});

	it('resolves Marp background images', () => {
		render('![bg right](images/bg.jpg)');
		expect(calls).toEqual([['images/bg.jpg', 'link']]);
	});

	it('leaves external URLs, non-image embeds and code alone', () => {
		const html = render(
			'![](https://example.com/a.png) ![[Note]] `![[a.png]]`\n\n```\n![[b.png]]\n```',
		);
		expect(calls).toEqual([]);
		expect(html).toContain('src="https://example.com/a.png"');
		expect(html).toContain('![[Note]]');
		expect(html).toContain('<code>![[a.png]]</code>');
		expect(html).toContain('![[b.png]]');
	});
});
