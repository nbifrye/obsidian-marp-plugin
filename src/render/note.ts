import { App, Editor, MarkdownView, TFile } from 'obsidian';
import { isMarpDocument } from './frontmatter';
import type { RenderEnv } from './obsidian-images';
import { previewUrl } from './resources';

/** The editor of a tab showing `file`, if one is open. */
function openEditor(app: App, file: TFile): Editor | undefined {
	let editor: Editor | undefined;
	app.workspace.iterateAllLeaves((leaf) => {
		if (
			editor === undefined &&
			leaf.view instanceof MarkdownView &&
			leaf.view.file === file
		) {
			editor = leaf.view.editor;
		}
	});
	return editor;
}

/**
 * The note's current text: the contents of an open editor (including unsaved
 * changes) or else the file on disk.
 */
export async function readNoteSource(app: App, file: TFile): Promise<string> {
	return (
		openEditor(app, file)?.getValue() ?? (await app.vault.cachedRead(file))
	);
}

/** The editor's lines up to the end of the frontmatter. */
function frontmatterLines(editor: Editor): string {
	const first = editor.getLine(0);
	if (first.replace(/^\uFEFF/, '') !== '---') return first;
	const lines = [first];
	for (let i = 1; i < editor.lineCount(); i++) {
		const line = editor.getLine(i);
		lines.push(line);
		if (/^---[ \t]*$/.test(line)) break;
	}
	return lines.join('\n');
}

/**
 * Whether the note is a Marp slide deck, cheaply enough to check whenever a
 * menu or the command palette opens. Uses an open editor's frontmatter, so it
 * agrees with what the slide actions render even before the edits are saved,
 * and else the metadata cache, which matches the file on disk.
 */
export function isMarpNote(app: App, file: TFile): boolean {
	if (file.extension !== 'md') return false;
	const editor = openEditor(app, file);
	if (editor) return isMarpDocument(frontmatterLines(editor));
	return app.metadataCache.getFileCache(file)?.frontmatter?.marp === true;
}

/** URL resolvers for showing a note's slides inside the app. */
export function previewResolvers(
	app: App,
	sourcePath: string,
): { env: RenderEnv; resolveMedia: (url: string) => string | undefined } {
	return {
		env: {
			resolveUrl: (url, kind) => previewUrl(app, url, sourcePath, kind),
		},
		resolveMedia: (url) => previewUrl(app, url, sourcePath),
	};
}
