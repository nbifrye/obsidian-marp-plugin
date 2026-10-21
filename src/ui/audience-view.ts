import { App, ItemView } from 'obsidian';
import type { RenderResult } from '../render/engine';
import { SlideFrame } from './slide-frame';

export const AUDIENCE_VIEW_TYPE = 'marp-core-slides-audience';

/** A presentation shown in an audience window, controlled by its owner. */
export interface AudienceSession {
	result: RenderResult;
	resolveMedia: (url: string) => string | undefined;
	csp: string;
	onLink: (href: string) => void;
	onClick: (event: MouseEvent) => void;
	onKeyDown: (event: KeyboardEvent) => void;
	/** Called when the view closes, e.g. because its window was closed. */
	onClose: () => void;
}

/**
 * Slides for the audience in a separate window (desktop only), while the
 * presentation modal in the main window shows the presenter view.
 */
export class AudienceView extends ItemView {
	private session: AudienceSession | null = null;
	private frame: SlideFrame | null = null;
	private stageEl!: HTMLElement;
	private index = 0;
	/** Resolves when the slides have been shown (for tests). */
	rendered: Promise<void> = Promise.resolve();

	getViewType(): string {
		return AUDIENCE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Slides for the audience';
	}

	getIcon(): string {
		return 'presentation';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('marp-core-slides-audience');
		this.stageEl = this.contentEl.createDiv({
			cls: 'marp-core-slides-stage',
		});
		// `addAction` is typed as 1.1.0+ but exists on every supported version.
		(
			this as unknown as {
				addAction?: (
					icon: string,
					title: string,
					callback: () => void,
				) => void;
			}
		).addAction?.('maximize', 'Toggle full screen', () =>
			this.toggleFullscreen(),
		);
		this.registerDomEvent(this.contentEl, 'keydown', (event) =>
			this.session?.onKeyDown(event),
		);
	}

	async onClose(): Promise<void> {
		const session = this.session;
		this.session = null;
		this.frame?.destroy();
		this.frame = null;
		session?.onClose();
	}

	/** Shows the session's slides, starting at the index. */
	present(session: AudienceSession, index: number): void {
		this.session = session;
		this.index = index;
		this.frame?.destroy();
		const frame = new SlideFrame(this.stageEl, {
			mode: 'present',
			csp: session.csp,
			onLink: session.onLink,
			onClick: session.onClick,
			onKeyDown: session.onKeyDown,
		});
		this.frame = frame;
		this.rendered = frame
			.show(session.result, session.resolveMedia)
			.then(() => {
				frame.setActiveSlide(this.index);
				frame.iframe.focus();
			});
	}

	setActiveSlide(index: number): void {
		this.index = index;
		this.frame?.setActiveSlide(index);
	}

	private toggleFullscreen(): void {
		const doc = this.contentEl.doc;
		if (doc.fullscreenElement) void doc.exitFullscreen();
		else void this.contentEl.requestFullscreen?.();
	}
}

/** Opens an audience view in a new window. */
export async function openAudienceWindow(
	app: App,
): Promise<AudienceView | null> {
	const leaf = app.workspace.openPopoutLeaf();
	await leaf.setViewState({ type: AUDIENCE_VIEW_TYPE, active: true });
	if (leaf.view instanceof AudienceView) return leaf.view;
	leaf.detach();
	return null;
}
