/**
 * markdown-it plugin that makes Obsidian-style image references work in Marp:
 * `![[image.png|300]]` embeds become image tokens, and the `src` of every
 * image token is rewritten through the resolver passed in the render env.
 * Working on tokens leaves code blocks and inline code untouched.
 */

/** Rewrites a vault-relative URL; returns undefined to keep it as written. */
export type UrlResolver = (
	url: string,
	kind: 'link' | 'embed',
) => string | undefined;

export interface RenderEnv {
	resolveUrl?: UrlResolver;
}

// Minimal shapes of the markdown-it internals used here.
interface Token {
	type: string;
	content: string;
	attrs: [string, string][] | null;
	children: Token[] | null;
	meta: unknown;
	attrGet(name: string): string | null;
	attrSet(name: string, value: string): void;
}
interface InlineState {
	src: string;
	pos: number;
	posMax: number;
	env: RenderEnv;
	tokens: Token[];
	Token: new (type: string, tag: string, nesting: number) => Token;
	push(type: string, tag: string, nesting: number): Token;
}
interface MarkdownIt {
	inline: {
		ruler: {
			before(
				name: string,
				rule: string,
				fn: (state: InlineState, silent: boolean) => boolean,
			): void;
		};
		ruler2: {
			before(
				name: string,
				rule: string,
				fn: (state: InlineState) => void,
			): void;
		};
	};
}

export const imageExtensions = [
	'apng',
	'avif',
	'bmp',
	'gif',
	'ico',
	'jpeg',
	'jpg',
	'png',
	'svg',
	'webp',
];

const embedMeta = Symbol('obsidian-embed');

/** Whether a URL points outside the vault (has a scheme, or is a fragment). */
export function isExternalUrl(url: string): boolean {
	return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url);
}

/** Turns the text after `|` in an embed into Marp image options. */
function embedAlt(option: string): string {
	const size = /^\s*(\d+)\s*(?:x\s*(\d+)\s*)?$/.exec(option);
	if (!size) return option.trim();
	return size[2] ? `w:${size[1]} h:${size[2]}` : `w:${size[1]}`;
}

function parseEmbed(state: InlineState, silent: boolean): boolean {
	const { src, pos } = state;
	if (!src.startsWith('![[', pos)) return false;
	const end = src.indexOf(']]', pos + 3);
	if (end < 0 || end > state.posMax) return false;

	const inner = src.slice(pos + 3, end);
	if (inner.includes('\n') || inner.includes('[')) return false;

	const bar = inner.indexOf('|');
	const target =
		(bar < 0 ? inner : inner.slice(0, bar)).split('#')[0]?.trim() ?? '';
	const extension = target.split('.').pop()?.toLowerCase() ?? '';
	if (!target || !imageExtensions.includes(extension)) return false;

	if (!silent) {
		const alt = bar < 0 ? '' : embedAlt(inner.slice(bar + 1));
		const token = state.push('image', 'img', 0);
		token.attrs = [
			['src', target],
			['alt', ''],
		];
		token.content = alt;
		token.meta = { [embedMeta]: true };
		const text = new state.Token('text', '', 0);
		text.content = alt;
		token.children = [text];
	}
	state.pos = end + 2;
	return true;
}

function isEmbed(token: Token): boolean {
	return !!(token.meta as Record<symbol, unknown> | null)?.[embedMeta];
}

function resolveImages(state: InlineState): void {
	const resolve = state.env?.resolveUrl;
	if (!resolve) return;
	const visit = (tokens: Token[]) => {
		for (const token of tokens) {
			if (token.type === 'image') {
				const src = token.attrGet('src');
				if (src && !isExternalUrl(src)) {
					const resolved = resolve(
						src,
						isEmbed(token) ? 'embed' : 'link',
					);
					if (resolved !== undefined) token.attrSet('src', resolved);
				}
			}
			if (token.children) visit(token.children);
		}
	};
	visit(state.tokens);
}

export function obsidianImagesPlugin(md: MarkdownIt): void {
	md.inline.ruler.before('image', 'obsidian_embed', parseEmbed);
	// Marpit reads the image URL in its own ruler2 rule (backgrounds etc.).
	md.inline.ruler2.before(
		'marpit_parse_image',
		'obsidian_resolve_image',
		resolveImages,
	);
}
