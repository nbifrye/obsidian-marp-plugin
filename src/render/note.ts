import { App, MarkdownView, TFile } from 'obsidian';
import type { RenderEnv } from './obsidian-images';
import { previewUrl } from './resources';

/**
 * The note's current text: the contents of an open editor (including unsaved
 * changes) or else the file on disk.
 */
export async function readNoteSource(app: App, file: TFile): Promise<string> {
	let editorText: string | undefined;
	app.workspace.iterateAllLeaves((leaf) => {
		if (
			editorText === undefined &&
			leaf.view instanceof MarkdownView &&
			leaf.view.file === file
		) {
			editorText = leaf.view.editor.getValue();
		}
	});
	return editorText ?? (await app.vault.cachedRead(file));
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
