import { describe, expect, it } from 'vitest';
import { MarkdownView, TFile } from 'obsidian';
import { isMarpNote } from '../../src/render/note';

function note(extension = 'md') {
	return Object.assign(new TFile(), {
		extension,
	});
}

/** An app with `text` open in an editor for `file`, if given. */
function fakeApp(file: TFile, cached: unknown, text?: string) {
	const lines = text?.split('\n') ?? [];
	const read: number[] = [];
	const view = Object.assign(
		Object.create(MarkdownView.prototype) as MarkdownView,
		{
			file,
			editor: {
				lineCount: () => lines.length,
				getLine: (i: number) => (read.push(i), lines[i] ?? ''),
			},
		},
	);
	const app = {
		workspace: {
			iterateAllLeaves(callback: (leaf: unknown) => void) {
				if (text !== undefined) callback({ view });
			},
		},
		metadataCache: {
			getFileCache: (f: TFile) =>
				f === file ? { frontmatter: cached } : null,
		},
	};
	return { app: app as never, read };
}

describe('isMarpNote', () => {
	it('uses the metadata cache when no editor shows the note', () => {
		const file = note();
		expect(isMarpNote(fakeApp(file, { marp: true }).app, file)).toBe(true);
		expect(isMarpNote(fakeApp(file, { marp: 'true' }).app, file)).toBe(
			false,
		);
		expect(isMarpNote(fakeApp(file, undefined).app, file)).toBe(false);
	});

	it('prefers unsaved editor contents over the metadata cache', () => {
		const file = note();
		const deck = '---\nmarp: true\n---\n\n# A';
		expect(isMarpNote(fakeApp(file, undefined, deck).app, file)).toBe(true);
		expect(isMarpNote(fakeApp(file, { marp: true }, '# A').app, file)).toBe(
			false,
		);
	});

	it.each([
		['﻿---\ntitle: x\nmarp: true\n---   \n# A', true],
		['---\n---\nmarp: true', false],
		['# A\n\n---\nmarp: true\n---', false],
		['---\nmarp: [', false],
	])('reads the frontmatter of %j as %s', (text, expected) => {
		const file = note();
		expect(isMarpNote(fakeApp(file, undefined, text).app, file)).toBe(
			expected,
		);
	});

	it('reads only the frontmatter lines', () => {
		const file = note();
		const body = Array.from({ length: 100 }, (_, i) => `line ${i}`);
		const deck = fakeApp(
			file,
			undefined,
			['---', 'marp: true', '---', ...body].join('\n'),
		);
		expect(isMarpNote(deck.app, file)).toBe(true);
		expect(deck.read).toEqual([0, 1, 2]);

		const plain = fakeApp(file, undefined, body.join('\n'));
		expect(isMarpNote(plain.app, file)).toBe(false);
		expect(plain.read).toEqual([0]);
	});

	it('rejects files that are not Markdown', () => {
		const file = note('canvas');
		expect(isMarpNote(fakeApp(file, { marp: true }).app, file)).toBe(false);
	});
});
