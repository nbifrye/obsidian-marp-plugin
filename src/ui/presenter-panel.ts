import { Component, setIcon } from 'obsidian';
import type { RenderResult } from '../render/engine';
import { SlideFrame } from './slide-frame';

/** Formats a duration as `mm:ss`, or `h:mm:ss` from an hour on. */
export function formatElapsed(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	const pad = (n: number) => String(n).padStart(2, '0');
	const h = Math.floor(seconds / 3600);
	const mmss = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
	return h ? `${h}:${mmss}` : mmss;
}

export interface PresenterPanelOptions {
	result: RenderResult;
	resolveMedia: (url: string) => string | undefined;
	csp: string;
	/** When the presentation started, for the elapsed time. */
	started: number;
	onKeyDown: (event: KeyboardEvent) => void;
}

/**
 * Information for the presenter beside the current slide: elapsed time, a
 * preview of the next slide and the current slide's notes. Notes are shown
 * as text only.
 */
export class PresenterPanel extends Component {
	readonly el: HTMLElement;
	private readonly next: SlideFrame;
	private readonly nextShown: Promise<void>;
	private readonly endEl: HTMLElement;
	private readonly notesEl: HTMLElement;
	private readonly elapsedEl: HTMLElement;
	private started: number;
	private index = 0;

	constructor(
		parent: HTMLElement,
		private readonly options: PresenterPanelOptions,
	) {
		super();
		this.started = options.started;
		this.el = parent.createDiv({ cls: 'marp-core-slides-presenter' });

		const timer = this.el.createDiv({ cls: 'marp-core-slides-timer' });
		this.elapsedEl = timer.createSpan({ cls: 'marp-core-slides-elapsed' });
		const reset = timer.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Reset timer' },
		});
		setIcon(reset, 'rotate-ccw');
		reset.addEventListener('click', () => {
			this.started = Date.now();
			this.tick();
		});

		const next = this.el.createDiv({ cls: 'marp-core-slides-next' });
		this.endEl = next.createDiv({
			cls: 'marp-core-slides-next-end',
			text: 'End of presentation',
		});
		this.next = new SlideFrame(next, {
			mode: 'present',
			csp: options.csp,
			onKeyDown: options.onKeyDown,
		});
		this.next.iframe.setAttribute('title', 'Next slide');
		this.nextShown = this.next.show(options.result, options.resolveMedia);

		this.notesEl = this.el.createDiv({ cls: 'marp-core-slides-notes' });
	}

	onload(): void {
		this.tick();
		this.registerInterval(window.setInterval(() => this.tick(), 1000));
	}

	onunload(): void {
		this.next.destroy();
		this.el.remove();
	}

	/** Shows the information for the slide at the index. */
	show(index: number): void {
		this.index = index;
		const notes = this.options.result.notes[index] ?? '';
		this.notesEl.setText(notes || 'No notes for this slide.');
		this.notesEl.toggleClass('is-empty', !notes);
		const last = index + 1 >= this.options.result.slides;
		this.endEl.toggle(last);
		this.next.iframe.toggle(!last);
		void this.nextShown.then(() =>
			this.next.setActiveSlide(this.index + 1),
		);
	}

	private tick(): void {
		this.elapsedEl.setText(formatElapsed(Date.now() - this.started));
	}
}
