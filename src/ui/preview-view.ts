import {
	debounce,
	ItemView,
	MarkdownView,
	Menu,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	type ViewStateResult,
} from 'obsidian';
import { exportHtml, startPresentation } from '../actions';
import type MarpPlugin from '../main';
import { isMarpDocument } from '../render/frontmatter';
import { imageExtensions } from '../render/obsidian-images';
import { previewResolvers, readNoteSource } from '../render/note';
import { slideAtLine } from '../render/slide-lines';
import { openSlideLink } from './links';
import { addSlideMenuItems } from './menus';
import { SlideFrame } from './slide-frame';

export const PREVIEW_VIEW_TYPE = 'marp-core-slides-preview';

const RENDER_DELAY = 250;
/** Waits for the cursor to rest, e.g. while a key is held down. */
const CURSOR_DELAY = 100;

interface PreviewState extends Record<string, unknown> {
	file?: string;
}

/**
 * Live preview of the Markdown note that was last active. Follows unsaved
 * editor changes, file switches, changes to images and themes, and the slide
 * the editor cursor is in.
 */
export class PreviewView extends ItemView {
	private readonly plugin: MarpPlugin;
	file: TFile | null = null;
	private frame: SlideFrame | null = null;
	private messageEl!: HTMLElement;
	private frameEl!: HTMLElement;
	private timer: number | undefined;
	/** Incremented per render; stale async results are dropped. */
	private generation = 0;
	/** Slide to keep in view across re-renders. */
	private currentSlide = 0;
	/** Whether the frame shows this file's slides, so its scroll position counts. */
	private positionKnown = false;
	/** The source line each shown slide starts at. */
	private slideLines: number[] = [];
	/** Slide of the editor cursor that was last scrolled to. */
	private cursorSlide: number | null = null;
	/**
	 * Whether to scroll to `currentSlide` once the frame is shown again: it
	 * cannot scroll while hidden, e.g. in a background tab on phones.
	 */
	private scrollOnShow = false;
	/** Renders requested, and the last one whose slides are shown. */
	private requested = 0;
	private shownRequest = 0;
	/** Resolves when the latest render has finished (for tests). */
	rendered: Promise<void> = Promise.resolve();

	constructor(leaf: WorkspaceLeaf, plugin: MarpPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PREVIEW_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file ? `Slides: ${this.file.basename}` : 'Slide preview';
	}

	getIcon(): string {
		return 'presentation';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('marp-core-slides-preview');
		this.messageEl = this.contentEl.createDiv({
			cls: 'marp-core-slides-message',
		});
		this.frameEl = this.contentEl.createDiv({
			cls: 'marp-core-slides-frame-container',
		});

		this.headerAction('play', 'Start presentation', () => {
			if (this.file) {
				void startPresentation(
					this.plugin,
					this.file,
					this.visibleSlide(),
				);
			}
		});
		this.headerAction('download', 'Export as HTML', () => {
			if (this.file) void exportHtml(this.plugin, this.file);
		});

		const { workspace, vault } = this.app;
		this.registerEvent(
			workspace.on('active-leaf-change', (leaf) => this.follow(leaf)),
		);
		this.registerEvent(
			workspace.on('file-open', () =>
				this.follow(workspace.getMostRecentLeaf()),
			),
		);
		this.registerEvent(
			workspace.on('editor-change', (_editor, info) => {
				if (info.file && info.file === this.file) this.schedule();
			}),
		);
		this.registerEvent(
			vault.on('modify', (file) => this.onFileChange(file)),
		);
		this.registerEvent(
			vault.on('create', (file) => this.onFileChange(file)),
		);
		this.registerEvent(
			vault.on('delete', (file) => {
				if (file === this.file) {
					this.file = null;
					this.refreshTitle();
					this.schedule();
				}
				this.onFileChange(file);
			}),
		);
		this.registerEvent(
			vault.on('rename', (file) => {
				if (file === this.file) this.refreshTitle();
				this.onFileChange(file);
			}),
		);
		this.registerEvent(
			this.plugin.events.on('refresh', () => this.recreateFrame()),
		);
		const followCursor = debounce(
			() => this.followCursor(),
			CURSOR_DELAY,
			true,
		);
		this.register(() => followCursor.cancel());
		this.registerEvent(
			this.plugin.events.on('cursor-move', () => followCursor()),
		);
		this.register(() => window.clearTimeout(this.timer));
		const observer = new ResizeObserver(() => {
			if (
				this.scrollOnShow &&
				this.positionKnown &&
				this.frameEl.isShown()
			) {
				this.scrollOnShow = false;
				this.frame?.scrollToSlide(this.currentSlide);
			}
		});
		observer.observe(this.frameEl);
		this.register(() => observer.disconnect());

		if (!this.file) this.follow(workspace.getMostRecentLeaf());
		this.recreateFrame();
	}

	async onClose(): Promise<void> {
		window.clearTimeout(this.timer);
		this.generation++;
		this.frame?.destroy();
		this.frame = null;
	}

	/**
	 * Adds a button to the view header. `addAction` is typed as 1.1.0+ but
	 * exists on every supported version (covered by the E2E tests on 1.0.3).
	 */
	private headerAction(icon: string, title: string, callback: () => void) {
		const view = this as unknown as {
			addAction?: (
				icon: string,
				title: string,
				callback: () => void,
			) => void;
		};
		view.addAction?.(icon, title, callback);
	}

	/** Adds the slide actions to the "More options" and tab header menus. */
	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		if (this.file) {
			addSlideMenuItems(menu, this.plugin, this.file, {
				preview: false,
				start: () => this.visibleSlide(),
			});
		}
	}

	/** The slide in view, or 0 while the frame shows something else. */
	private visibleSlide(): number {
		return this.positionKnown ? (this.frame?.visibleSlide() ?? 0) : 0;
	}

	getState(): Record<string, unknown> {
		return { file: this.file?.path };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const path = (state as PreviewState | null)?.file;
		if (typeof path === 'string') {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) this.setFile(file);
		}
		await super.setState(state, result);
	}

	setFile(file: TFile): void {
		if (file === this.file) return;
		this.file = file;
		this.currentSlide = 0;
		this.positionKnown = false;
		this.cursorSlide = null;
		this.refreshTitle();
		this.schedule(0);
	}

	private follow(leaf: WorkspaceLeaf | null): void {
		const view = leaf?.view;
		if (view instanceof MarkdownView && view.file) this.setFile(view.file);
	}

	private refreshTitle(): void {
		// Not in the public API: updates the tab title after the file changed.
		(
			this.leaf as unknown as { updateHeader?: () => void }
		).updateHeader?.();
	}

	private onFileChange(file: TAbstractFile): void {
		if (!(file instanceof TFile)) return;
		if (
			file === this.file ||
			imageExtensions.includes(file.extension.toLowerCase())
		) {
			this.schedule();
		}
	}

	/** Rebuilds the frame (e.g. for a new CSP) and renders again. */
	private recreateFrame(): void {
		if (!this.frameEl) return;
		this.readPosition();
		this.positionKnown = false;
		this.frame?.destroy();
		this.frame = new SlideFrame(this.frameEl, {
			mode: 'list',
			csp: this.plugin.csp(),
			onLink: (href) =>
				openSlideLink(this.app, href, this.file?.path ?? '', (index) =>
					this.frame?.scrollToSlide(index),
				),
		});
		this.schedule(0);
	}

	schedule(delay = RENDER_DELAY): void {
		this.requested++;
		window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.rendered = this.render();
		}, delay);
	}

	private showMessage(text: string | null): void {
		if (text !== null) this.positionKnown = false;
		this.messageEl.setText(text ?? '');
		this.messageEl.toggle(text !== null);
		this.frameEl.toggle(text === null);
	}

	/**
	 * Scrolls to the slide the active editor's cursor is in, if that editor
	 * shows this file and the cursor moved to another slide since the last
	 * time. Within a slide, the preview stays where it was scrolled to.
	 */
	private followCursor(): void {
		const { file, frame } = this;
		// Until the latest changes are shown, the slides' lines may not match
		// the editor's; the render calls this again.
		if (
			!file ||
			!frame ||
			!this.positionKnown ||
			this.shownRequest !== this.requested
		) {
			return;
		}
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.file !== file) return;
		const slide = slideAtLine(
			this.slideLines,
			view.editor.getCursor().line,
		);
		if (slide === this.cursorSlide) return;
		this.cursorSlide = slide;
		this.currentSlide = slide;
		if (this.frameEl.isShown()) frame.scrollToSlide(slide);
		else this.scrollOnShow = true;
	}

	/**
	 * Keeps the slide in view across re-renders. A hidden frame has no layout
	 * to read it from, so the last known slide stays.
	 */
	private readPosition(): void {
		if (this.frame && this.positionKnown && this.frameEl.isShown()) {
			this.currentSlide = this.frame.visibleSlide();
		}
	}

	private async render(): Promise<void> {
		const request = this.requested;
		const generation = ++this.generation;
		const stale = () => generation !== this.generation;
		const { file, frame } = this;
		if (!frame) return;
		if (!file) {
			this.showMessage(
				'Open a note with "marp: true" in its properties.',
			);
			return;
		}

		try {
			const source = await readNoteSource(this.app, file);
			if (stale()) return;
			if (!isMarpDocument(source)) {
				this.showMessage(
					'This note is not a Marp slide deck. Add "marp: true" to its properties.',
				);
				return;
			}
			const engine = await this.plugin.engines.get();
			if (stale()) return;

			this.readPosition();
			const { env, resolveMedia } = previewResolvers(this.app, file.path);
			const result = engine.render(source, env);
			await frame.show(result, resolveMedia);
			if (stale()) return;
			this.showMessage(null);
			this.currentSlide = Math.max(
				0,
				Math.min(this.currentSlide, result.slides - 1),
			);
			frame.scrollToSlide(this.currentSlide);
			this.positionKnown = true;
			this.slideLines = result.slideLines;
			this.shownRequest = request;
			this.followCursor();
		} catch (e) {
			if (stale()) return;
			console.error(e);
			this.showMessage(
				`Could not render the slides: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}
}
