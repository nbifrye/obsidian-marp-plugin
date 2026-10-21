import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/render/engine';
import { slideAtLine } from '../../src/render/slide-lines';

const render = (markdown: string) =>
	createEngine({ math: 'mathjax', html: 'allowlist', themes: [] }).render(
		markdown,
	);

describe('slide lines', () => {
	it('starts the first slide at the top, including the front matter', () => {
		const { slideLines } = render(
			['---', 'marp: true', '---', '', '# A', '', '---', '', '# B'].join(
				'\n',
			),
		);
		expect(slideLines).toEqual([0, 6]);
	});

	it('ignores --- in code blocks and setext headings', () => {
		const { slideLines, slides } = render(
			[
				'# A', // 0
				'',
				'```',
				'---',
				'```',
				'',
				'Title', // 6
				'---',
				'',
				'***', // 9
				'',
				'# B',
			].join('\n'),
		);
		expect(slides).toBe(2);
		expect(slideLines).toEqual([0, 9]);
	});

	it('splits at headings with the headingDivider directive', () => {
		const { slideLines } = render(
			[
				'---',
				'marp: true',
				'headingDivider: 2',
				'---',
				'',
				'# A', // 5
				'',
				'## B', // 7
				'',
				'### C',
				'',
				'## D', // 11
			].join('\n'),
		);
		expect(slideLines).toEqual([0, 7, 11]);
	});

	it('has one slide for a note without content', () => {
		expect(render('---\nmarp: true\n---\n').slideLines).toEqual([0]);
	});

	it('maps a line to the slide that contains it', () => {
		const lines = [0, 6, 10];
		expect(slideAtLine(lines, 0)).toBe(0);
		expect(slideAtLine(lines, 5)).toBe(0);
		// The --- line starts the next slide.
		expect(slideAtLine(lines, 6)).toBe(1);
		expect(slideAtLine(lines, 9)).toBe(1);
		expect(slideAtLine(lines, 10)).toBe(2);
		expect(slideAtLine(lines, 99)).toBe(2);
		expect(slideAtLine([], 3)).toBe(0);
	});
});
