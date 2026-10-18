import { App, Modal, TFile, setIcon } from 'obsidian';
import type { RenderResult } from '../render/engine';
import { openSlideLink } from './links';
import { SlideFrame } from './slide-frame';

const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];

/**
 * Full-window presentation showing one slide at a time. Keyboard, buttons
 * and tapping the left or right half of the slide move between slides.
 */
export class PresentationModal extends Modal {
	private frame: SlideFrame | null = null;
	private counterEl!: HTMLElement;
	index: number;
	private total: number;

	constructor(
		app: App,
		private readonly file: TFile,
		private readonly result: RenderResult,
		private readonly resolveMedia: (url: string) => string | undefined,
		private readonly csp: string,
		start: number,
	) {
		super(app);
		this.total = result.slides;
		this.index = Math.max(0, Math.min(start, this.total - 1));
	}

	onOpen(): void {
		this.modalEl.addClass('marp-core-slides-presentation');
		this.containerEl.addClass('marp-core-slides-presentation-container');
		this.contentEl.empty();

		const stage = this.contentEl.createDiv({
			cls: 'marp-core-slides-stage',
		});
		this.frame = new SlideFrame(stage, {
			mode: 'present',
			csp: this.csp,
			onLink: (href) =>
				openSlideLink(this.app, href, this.file.path, (i) =>
					this.go(i),
				),
			onClick: (event) => {
				const width = event.view?.innerWidth ?? window.innerWidth;
				if (event.clientX < width / 2) this.previous();
				else this.next();
			},
			onKeyDown: (event) => this.handleKey(event),
		});

		const toolbar = this.contentEl.createDiv({
			cls: 'marp-core-slides-toolbar',
		});
		this.button(toolbar, 'chevron-left', 'Previous slide', () =>
			this.previous(),
		);
		this.counterEl = toolbar.createSpan({
			cls: 'marp-core-slides-counter',
		});
		this.button(toolbar, 'chevron-right', 'Next slide', () => this.next());
		if (activeDocument.fullscreenEnabled) {
			this.button(toolbar, 'maximize', 'Toggle full screen', () =>
				this.toggleFullscreen(),
			);
		}
		this.button(toolbar, 'x', 'End presentation', () => this.close());

		for (const key of [...nextKeys, ...previousKeys, 'Home', 'End']) {
			this.scope.register([], key, (event) => {
				this.handleKey(event);
				return false;
			});
		}

		void this.frame.show(this.result, this.resolveMedia).then(() => {
			this.go(this.index);
			this.frame?.iframe.focus();
		});
	}

	onClose(): void {
		if (activeDocument.fullscreenElement)
			void activeDocument.exitFullscreen();
		this.frame?.destroy();
		this.frame = null;
		this.contentEl.empty();
	}

	private button(
		parent: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void,
	): void {
		const button = parent.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': label },
		});
		setIcon(button, icon);
		button.addEventListener('click', onClick);
	}

	private handleKey(event: KeyboardEvent): void {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (nextKeys.includes(event.key)) this.next();
		else if (previousKeys.includes(event.key)) this.previous();
		else if (event.key === 'Home') this.go(0);
		else if (event.key === 'End') this.go(this.total - 1);
		else if (event.key === 'Escape') this.close();
		else return;
		event.preventDefault();
	}

	next(): void {
		this.go(this.index + 1);
	}

	previous(): void {
		this.go(this.index - 1);
	}

	go(index: number): void {
		this.index = Math.max(0, Math.min(index, this.total - 1));
		this.frame?.setActiveSlide(this.index);
		this.counterEl.setText(`${this.index + 1} / ${this.total}`);
	}

	private toggleFullscreen(): void {
		if (activeDocument.fullscreenElement) {
			void activeDocument.exitFullscreen();
		} else {
			void this.modalEl.requestFullscreen?.();
		}
	}
}
