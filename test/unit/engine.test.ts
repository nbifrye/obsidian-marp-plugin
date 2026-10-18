import { describe, expect, it } from 'vitest';
import { createEngine, type EngineOptions } from '../../src/render/engine';

const base: EngineOptions = { math: 'mathjax', html: 'allowlist', themes: [] };
const doc = (body: string, front = '') =>
	`---\nmarp: true\n${front}---\n\n${body}\n`;

describe('engine', () => {
	it('renders one section per slide', () => {
		const result = createEngine(base).render(doc('# A\n\n---\n\n# B'));
		expect(result.slides).toBe(2);
		expect(result.html.match(/<section/g)).toHaveLength(2);
	});

	it('typesets math with MathJax by default', () => {
		const { html } = createEngine(base).render(doc('$$\n\\int x\n$$'));
		expect(html).toContain('mjx-container');
	});

	it('typesets math with KaTeX and embeds its fonts', () => {
		const { html, css } = createEngine({ ...base, math: 'katex' }).render(
			doc('$x^2$'),
		);
		expect(html).toContain('class="katex"');
		const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
		expect(faces).toHaveLength(20);
		for (const face of faces) {
			expect(face).toMatch(
				/src:\s*url\(data:font\/woff2;base64,[^)]+\) format\("woff2"\);?\s*\}$/,
			);
		}
		expect(css).not.toMatch(/url\(['"]?fonts\//);
		expect(css).not.toContain('cdn.jsdelivr.net');
	});

	it('lets the math directive override the setting', () => {
		const { html } = createEngine(base).render(doc('$x$', 'math: katex\n'));
		expect(html).toContain('class="katex"');
	});

	it('highlights code with Shiki', () => {
		const { html } = createEngine(base).render(
			doc('```js\nconst a = 1\n```'),
		);
		expect(html).toContain('shiki');
		expect(html).toContain('language-js');
	});

	it('renders Mermaid diagrams as SVG', () => {
		const { html } = createEngine(base).render(
			doc('```mermaid\ngraph TD\n  A --> B\n```'),
		);
		expect(html).toContain('data-marp-mermaid');
	});

	it('falls back to a code block for unsupported Mermaid', () => {
		const { html } = createEngine(base).render(
			doc('```mermaid\nnot a diagram\n```'),
		);
		expect(html).not.toContain('data-marp-mermaid');
		expect(html).toContain('not a diagram');
	});

	it('renders emoji shortcodes as Unicode without Twemoji', () => {
		const { html } = createEngine(base).render(doc(':smile: 😀'));
		expect(html).toContain('😄');
		expect(html).not.toContain('twemoji');
	});
});

describe('custom themes', () => {
	const theme = (name: string, color: string) =>
		`/* @theme ${name} */\n@import "default";\nsection { color: ${color}; }`;

	it('registers themes and reports duplicates without replacing', () => {
		const engine = createEngine({
			...base,
			themes: [
				{ path: 'Themes/a.css', css: theme('mine', 'red') },
				{ path: 'Themes/b.css', css: theme('mine', 'blue') },
				{ path: 'Themes/c.css', css: theme('gaia', 'green') },
				{ path: 'Themes/d.css', css: 'section { color: black; }' },
				// Marpit uses the last @theme, so these must be caught too.
				{
					path: 'Themes/e.css',
					css: '/* @theme unused */\n/* @theme gaia */\nsection { color: green; }',
				},
				{
					path: 'Themes/f.css',
					css: '/* @theme\nuncover */\nsection { color: green; }',
				},
			],
		});
		expect(engine.themeErrors.map((e) => e.path)).toEqual([
			'Themes/b.css',
			'Themes/c.css',
			'Themes/d.css',
			'Themes/e.css',
			'Themes/f.css',
		]);
		const { css } = engine.render(doc('# A', 'theme: mine\n'));
		expect(css).toContain('red');
		expect(css).not.toContain('blue');
		const gaia = engine.render(doc('# A', 'theme: gaia\n')).css;
		expect(gaia).not.toContain('green');
	});
});
