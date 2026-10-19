// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { App, TFile } from 'obsidian';
import { buildStandaloneHtml } from '../../src/export/html';
import { DEFAULT_SETTINGS } from '../../src/settings';

function vaultFile(path: string): TFile {
	const name = path.split('/').pop() ?? path;
	return Object.assign(new TFile(), {
		path,
		name,
		basename: name.replace(/\.[^.]*$/, ''),
		extension: name.split('.').pop() ?? '',
	});
}

const secret = 'TOP-SECRET-DIARY';
const contents: Record<string, string> = {
	'Private/diary.md': secret,
	'image.png': 'PNG-DATA',
};
const files = new Map(
	Object.keys(contents).map((path) => [path, vaultFile(path)]),
);
const deck = vaultFile('deck.md');

const app = {
	vault: {
		getAbstractFileByPath: (path: string) => files.get(path) ?? null,
		getFiles: () => [...files.values()],
		readBinary: (file: TFile) =>
			Promise.resolve(
				new TextEncoder().encode(contents[file.path]).buffer,
			),
		cachedRead: () => Promise.resolve(''),
	},
	metadataCache: { getFirstLinkpathDest: () => null },
} as unknown as App;

function exportDeck(body: string) {
	return buildStandaloneHtml(
		app,
		DEFAULT_SETTINGS,
		deck,
		`---\nmarp: true\n---\n\n${body}\n`,
	);
}

describe('buildStandaloneHtml', () => {
	it.each([
		'<img src="Private/diary.md" style="display:none">',
		'![bg](Private/diary.md)',
		'![](Private/diary.md)',
	])('never embeds files that are not media: %s', async (body) => {
		const { html, skipped } = await exportDeck(body);
		expect(html).not.toContain(btoa(secret));
		expect(skipped).toEqual(['Private/diary.md']);
	});

	it.each(['<img src="image.png">', '![bg](image.png)', '![](image.png)'])(
		'embeds images: %s',
		async (body) => {
			const { html, missing, skipped } = await exportDeck(body);
			expect(html).toContain(`data:image/png;base64,${btoa('PNG-DATA')}`);
			expect(missing).toEqual([]);
			expect(skipped).toEqual([]);
		},
	);
});
