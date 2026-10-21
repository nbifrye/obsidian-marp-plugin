import { Marp } from '@marp-team/marp-core';
import { Theme } from '@marp-team/marpit';
import katexPlugin from '@marp-team/marp-core/plugins/katex';
import mathjaxPlugin from '@marp-team/marp-core/plugins/mathjax';
import mermaidPlugin from '@marp-team/marp-core/plugins/mermaid';
import shikiPlugin from '@marp-team/marp-core/plugins/shiki';
import type { HtmlMode, MathEngine } from '../settings';
import { embedKatexFonts } from './katex-fonts';
import { obsidianImagesPlugin, type RenderEnv } from './obsidian-images';
import { slideLinesPlugin, type SlideLinesEnv } from './slide-lines';

export interface EngineOptions {
	math: MathEngine;
	html: HtmlMode;
	/** Custom theme stylesheets, with their URLs already resolved. */
	themes: { path: string; css: string }[];
}

export interface RenderResult {
	html: string;
	css: string;
	/** Number of slides. */
	slides: number;
	/**
	 * Presenter notes per slide: the slide's HTML comments (other than
	 * directives), as plain text. Never insert them as HTML.
	 */
	notes: string[];
	/** The source line (0-based) each slide starts at. */
	slideLines: number[];
}

export interface Engine {
	render(markdown: string, env?: RenderEnv): RenderResult;
	/** Themes that could not be registered, with the reason. */
	themeErrors: { path: string; message: string }[];
}

function htmlOption(mode: HtmlMode): boolean | undefined {
	if (mode === 'off') return false;
	if (mode === 'all') return true;
	// Marp Core's default allowlist.
	return undefined;
}

/**
 * Creates a Marp Core v5 converter with all core plugins (Shiki, Mermaid,
 * KaTeX, MathJax) enabled. Rendering is synchronous.
 */
export function createEngine(options: EngineOptions): Engine {
	const html = htmlOption(options.html);
	const marp = new Marp({
		...(html === undefined ? {} : { html }),
		math: options.math,
		// Unicode emoji instead of Twemoji images from a CDN.
		emoji: { shortcode: true, unicode: false },
		// The plugin applies the browser helper itself; scripts in the output
		// would not run in the preview anyway.
		script: false,
	})
		.use(mathjaxPlugin())
		.use(katexPlugin({ fontPath: false }))
		.use(shikiPlugin())
		.use(mermaidPlugin())
		.use(obsidianImagesPlugin)
		.use(slideLinesPlugin);

	const themeErrors: Engine['themeErrors'] = [];
	const { themeSet } = marp;
	for (const theme of options.themes) {
		try {
			// Same as themeSet.add(), which would silently replace a theme with
			// the same name (including built-in ones).
			const parsed = Theme.fromCSS(theme.css, {
				metaType: themeSet.metaType,
				cssNesting: themeSet.cssNesting,
			});
			if (themeSet.has(parsed.name)) {
				throw new Error(
					`a theme named "${parsed.name}" already exists`,
				);
			}
			themeSet.addTheme(parsed);
		} catch (e) {
			themeErrors.push({
				path: theme.path,
				message: e instanceof Error ? e.message : String(e),
			});
		}
	}

	return {
		themeErrors,
		render(markdown, env = {}) {
			const slideLines: number[] = [];
			const { html, css, comments } = marp.render(markdown, {
				...env,
				slideLines,
			} satisfies RenderEnv & SlideLinesEnv);
			return {
				html,
				css: embedKatexFonts(css),
				slides: comments.length,
				notes: comments.map((c) => c.join('\n\n')),
				slideLines,
			};
		},
	};
}
