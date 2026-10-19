import { browser, type MarpCoreBrowser } from '@marp-team/marp-core/browser';
import {
	parseHtml,
	resolveMediaUrls,
	sanitizeFragment,
} from '../render/sanitize';

/**
 * - list: every slide stacked vertically (preview)
 * - present: one slide at a time, fitted to the frame
 * - print: every slide, laid out by Marp's print styles
 */
export type FrameMode = 'list' | 'present' | 'print';

export interface SlideFrameOptions {
	mode: FrameMode;
	csp: string;
	/** Called instead of following a clicked link. */
	onLink?: (href: string) => void;
	/** Clicks that are not on a link. */
	onClick?: (event: MouseEvent) => void;
	onKeyDown?: (event: KeyboardEvent) => void;
}

export interface SlideContent {
	html: string;
	css: string;
}

const shellCss = `
html, body { margin: 0; }
body { background: var(--marp-frame-background, #f0f0f0); }
body.mode-list { padding: 16px; }
body.mode-list div.marpit { display: flex; flex-direction: column; gap: 16px; }
body.mode-list div.marpit > svg {
	display: block; width: 100%; height: auto;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
html.mode-present, body.mode-present { height: 100%; overflow: hidden; background: #000; }
body.mode-present #marp-root, body.mode-present div.marpit { height: 100%; }
body.mode-present div.marpit > svg { display: none; width: 100%; height: 100%; }
body.mode-present div.marpit > svg.marp-active { display: block; }
`;

function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;');
}

/**
 * The link an event happened in, if any: an HTML or SVG `<a>`, or an image
 * map's `<area>`.
 */
export function linkOf(target: EventTarget | null): Element | null {
	return (target as Element | null)?.closest?.('a, area') ?? null;
}

const xlinkNamespace = 'http://www.w3.org/1999/xlink';

function linkHref(link: Element): string | null {
	return (
		link.getAttribute('href') ??
		link.getAttributeNS(xlinkNamespace, 'href') ??
		link.getAttribute('xlink:href')
	);
}

/**
 * Shows rendered slides in an iframe, isolating Marp's styles and IDs from
 * Obsidian. The iframe is sandboxed without scripts and has a strict CSP;
 * the plugin inserts content and applies Marp's browser helper from outside.
 */
export class SlideFrame {
	readonly iframe: HTMLIFrameElement;
	private readonly options: SlideFrameOptions;
	private readonly loaded: Promise<Document>;
	private helper: MarpCoreBrowser | undefined;
	private destroyed = false;

	constructor(container: HTMLElement, options: SlideFrameOptions) {
		this.options = options;
		const background =
			getComputedStyle(container)
				.getPropertyValue('--background-secondary')
				.trim() || '#f0f0f0';

		this.iframe = container.createEl('iframe', {
			cls: 'marp-core-slides-frame',
		});
		const sandbox = ['allow-same-origin'];
		if (options.mode === 'print') sandbox.push('allow-modals');
		this.iframe.setAttribute('sandbox', sandbox.join(' '));
		this.iframe.setAttribute('title', 'Slides');

		this.loaded = new Promise((resolve) => {
			this.iframe.addEventListener(
				'load',
				() => {
					const doc = this.iframe.contentDocument;
					if (doc) {
						this.attachListeners(doc);
						resolve(doc);
					}
				},
				{ once: true },
			);
		});
		this.iframe.srcdoc = `<!doctype html><html class="mode-${options.mode}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(options.csp)}"><style id="marp-shell">:root { --marp-frame-background: ${background}; }${shellCss}</style><style id="marp-style"></style></head><body class="mode-${options.mode}"><div id="marp-root"></div></body></html>`;
	}

	/** Resolves with the frame's document once its shell has loaded. */
	ready(): Promise<Document> {
		return this.loaded;
	}

	private attachListeners(doc: Document): void {
		doc.addEventListener('click', (event) => {
			const link = linkOf(event.target);
			if (link) {
				event.preventDefault();
				const href = linkHref(link);
				if (href) this.options.onLink?.(href);
				return;
			}
			this.options.onClick?.(event);
		});
		// Links must never navigate the frame, also with modifier keys.
		doc.addEventListener('auxclick', (event) => {
			if (linkOf(event.target)) event.preventDefault();
		});
		doc.addEventListener('submit', (event) => event.preventDefault());
		if (this.options.onKeyDown) {
			doc.addEventListener('keydown', this.options.onKeyDown);
		}
	}

	/** Replaces the shown slides. Content is sanitized before attaching. */
	async show(
		content: SlideContent,
		resolveMedia?: (url: string) => string | undefined,
	): Promise<void> {
		const doc = await this.loaded;
		if (this.destroyed) return;

		// Parsed into a detached document and sanitized before it is attached.
		const parsed = parseHtml(content.html);
		sanitizeFragment(parsed);
		if (resolveMedia) resolveMediaUrls(parsed, resolveMedia);

		const style = doc.getElementById('marp-style');
		const root = doc.getElementById('marp-root');
		if (!style || !root) return;
		style.textContent = content.css;
		root.replaceChildren(...Array.from(parsed.childNodes));

		this.helper = this.helper ? this.helper.update() : browser(root);
	}

	get document(): Document | null {
		return this.iframe.contentDocument;
	}

	slides(): SVGSVGElement[] {
		return Array.from(
			this.document?.querySelectorAll<SVGSVGElement>(
				'#marp-root div.marpit > svg',
			) ?? [],
		);
	}

	/** In list mode, the index of the topmost slide that is in view. */
	visibleSlide(): number {
		const slides = this.slides();
		const index = slides.findIndex(
			(slide) => slide.getBoundingClientRect().bottom > 8,
		);
		return Math.max(0, index);
	}

	scrollToSlide(index: number): void {
		const slides = this.slides();
		const slide = slides[Math.min(index, slides.length - 1)];
		const scroller = this.document?.scrollingElement;
		if (!slide || !scroller) return;
		scroller.scrollTop =
			slide.getBoundingClientRect().top + scroller.scrollTop - 16;
	}

	/** In present mode, shows only the slide at the index. */
	setActiveSlide(index: number): void {
		this.slides().forEach((slide, i) =>
			slide.classList.toggle('marp-active', i === index),
		);
	}

	destroy(): void {
		this.destroyed = true;
		this.helper?.cleanup();
		this.helper = undefined;
		this.iframe.remove();
	}
}
