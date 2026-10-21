import { MarkdownView, Notice, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import type MarpPlugin from './main';
import { isMarpDocument } from './render/frontmatter';
import { previewResolvers, readNoteSource } from './render/note';
import { PresentationModal } from './ui/presentation-modal';
import { PREVIEW_VIEW_TYPE, PreviewView } from './ui/preview-view';
import { ConfirmModal } from './ui/confirm-modal';

const notMarp =
	'This note is not a Marp slide deck. Add "marp: true" to its properties.';

/** The note commands act on: the active note, or the active preview's note. */
export function targetFile(plugin: MarpPlugin): TFile | null {
	const { workspace } = plugin.app;
	const markdown = workspace.getActiveViewOfType(MarkdownView);
	if (markdown?.file) return markdown.file;
	const preview = workspace.getActiveViewOfType(PreviewView);
	return preview?.file ?? null;
}

export async function openPreview(
	plugin: MarpPlugin,
	file: TFile | null,
): Promise<PreviewView | null> {
	const { workspace } = plugin.app;
	let leaf: WorkspaceLeaf | undefined =
		workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)[0];
	if (!leaf) {
		leaf = Platform.isMobile
			? workspace.getLeaf('tab')
			: workspace.getLeaf('split', 'vertical');
		await leaf.setViewState({ type: PREVIEW_VIEW_TYPE, active: false });
	}
	// Background tabs restored on 1.7.2+ hold a placeholder view until shown.
	const { loadIfDeferred } = leaf as unknown as {
		loadIfDeferred?: () => Promise<void>;
	};
	await loadIfDeferred?.call(leaf);
	const view = leaf.view;
	if (!(view instanceof PreviewView)) return null;
	if (file) view.setFile(file);
	// Typed as 1.7.2+ because it returns a promise since then, but it exists
	// on every supported version (covered by the E2E tests on 1.0.3).
	const { revealLeaf } = workspace as unknown as {
		revealLeaf?: (leaf: WorkspaceLeaf) => unknown;
	};
	void revealLeaf?.call(workspace, leaf);
	return view;
}

async function renderNote(plugin: MarpPlugin, file: TFile) {
	const source = await readNoteSource(plugin.app, file);
	if (!isMarpDocument(source)) {
		new Notice(notMarp);
		return null;
	}
	const engine = await plugin.engines.get();
	const { env, resolveMedia } = previewResolvers(plugin.app, file.path);
	return { source, result: engine.render(source, env), resolveMedia };
}

export async function startPresentation(
	plugin: MarpPlugin,
	file: TFile,
	start = 0,
): Promise<PresentationModal | null> {
	const rendered = await renderNote(plugin, file);
	if (!rendered) return null;
	const modal = new PresentationModal(
		plugin.app,
		file,
		rendered.result,
		rendered.resolveMedia,
		plugin.csp(),
		start,
	);
	modal.open();
	return modal;
}

/** Saves `<note>.html` next to the note. Returns the saved file. */
export async function exportHtml(
	plugin: MarpPlugin,
	file: TFile,
	confirmOverwrite = true,
): Promise<TFile | null> {
	const { app } = plugin;
	const source = await readNoteSource(app, file);
	if (!isMarpDocument(source)) {
		new Notice(notMarp);
		return null;
	}
	const folder = file.parent?.path ?? '';
	const path = `${folder && folder !== '/' ? `${folder}/` : ''}${file.basename}.html`;
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing && !(existing instanceof TFile)) {
		new Notice(`Cannot export: ${path} is a folder.`);
		return null;
	}
	if (
		existing &&
		confirmOverwrite &&
		!(await new ConfirmModal(
			app,
			`${path} already exists. Replace it?`,
			'Replace',
		).ask())
	) {
		return null;
	}

	try {
		const { buildStandaloneHtml } = await import('./export/html');
		const { html, missing, skipped } = await buildStandaloneHtml(
			app,
			plugin.settings,
			file,
			source,
		);
		const saved = existing
			? (await app.vault.modify(existing, html), existing)
			: await app.vault.create(path, html);
		const problems = [
			missing.length &&
				`these files were not found: ${missing.join(', ')}`,
			skipped.length &&
				`these files are not images or media and were left out: ${skipped.join(', ')}`,
		].filter(Boolean);
		new Notice(
			problems.length
				? `Exported to ${path}, but ${problems.join('; ')}`
				: `Exported to ${path}`,
		);
		return saved;
	} catch (e) {
		console.error(e);
		new Notice(
			`Could not export: ${e instanceof Error ? e.message : String(e)}`,
		);
		return null;
	}
}

export async function printNote(
	plugin: MarpPlugin,
	file: TFile,
): Promise<void> {
	const rendered = await renderNote(plugin, file);
	if (!rendered) return;
	const { printSlides } = await import('./export/print');
	await printSlides(rendered.result, rendered.resolveMedia, plugin.csp());
}
