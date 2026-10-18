import { isExternalUrl } from './obsidian-images';

/**
 * Last line of defence applied to rendered slides before they are attached to
 * a document, whatever the HTML setting: removes everything that could run
 * code, navigate, submit or embed other documents. Works on an inert
 * detached document (see `parseHtml`), so nothing has been fetched yet.
 */

const removedElements = [
	'script',
	'iframe',
	'frame',
	'frameset',
	'object',
	'embed',
	'applet',
	'portal',
	'meta',
	'base',
	'noscript',
	// SVG animation can set attributes such as href after sanitizing.
	'set',
	'animate',
	'animateMotion',
	'animateTransform',
	'discard',
	'handler',
	'listener',
].join(',');

const urlAttributes = new Set([
	'href',
	'xlink:href',
	'src',
	'srcset',
	'action',
	'formaction',
	'poster',
	'data',
	'background',
	'ping',
	'lowsrc',
	'dynsrc',
	'codebase',
	'cite',
	'longdesc',
	'manifest',
]);

const safeDataUrl =
	/^data:(?:image\/(?:apng|avif|bmp|gif|jpeg|png|webp|x-icon|svg\+xml)|font\/[\w.+-]+|video\/[\w.+-]+|audio\/[\w.+-]+)[;,]/i;

/** Whether a URL attribute value would run code or load a document. */
export function isDangerousUrl(value: string): boolean {
	// Browsers ignore whitespace and control characters inside the scheme.
	// eslint-disable-next-line no-control-regex -- matching control characters is the point
	const url = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
	const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url)?.[1]?.toLowerCase();
	if (!scheme) return false;
	if (scheme === 'data') return !safeDataUrl.test(url);
	return ![
		'http',
		'https',
		'mailto',
		'tel',
		'blob',
		'app',
		'capacitor',
	].includes(scheme);
}

/**
 * Parses HTML into the body of a detached document: scripts never run and
 * media never loads until the nodes are moved into a live document.
 */
export function parseHtml(html: string): HTMLElement {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	// Leading metadata elements such as <style> or <meta> land in <head>.
	doc.body.prepend(...Array.from(doc.head.childNodes));
	return doc.body;
}

export function sanitizeFragment(root: ParentNode): void {
	root.querySelectorAll(removedElements).forEach((el) => el.remove());
	// Only stylesheets may stay among <link>s (prefetch, import etc. go).
	root.querySelectorAll('link').forEach((el) => {
		if (
			(el.getAttribute('rel') ?? '').trim().toLowerCase() !== 'stylesheet'
		) {
			el.remove();
		}
	});

	root.querySelectorAll('*').forEach((el) => {
		for (const attr of Array.from(el.attributes)) {
			const name = attr.name.toLowerCase();
			if (
				name.startsWith('on') ||
				name === 'target' ||
				name === 'formtarget' ||
				name === 'http-equiv' ||
				(urlAttributes.has(name) && isDangerousUrl(attr.value)) ||
				(name === 'srcset' &&
					attr.value.split(',').some((c) => isDangerousUrl(c.trim())))
			) {
				el.removeAttribute(attr.name);
			}
		}
		if (el.localName === 'form') el.removeAttribute('action');
	});
}

/**
 * Rewrites relative media URLs written in raw HTML (`<img src>` etc.),
 * which do not go through markdown-it's image tokens.
 */
export function resolveMediaUrls(
	root: ParentNode,
	resolve: (url: string) => string | undefined,
): void {
	const rewrite = (el: Element, attr: string) => {
		const value = el.getAttribute(attr);
		if (!value || isExternalUrl(value)) return;
		const resolved = resolve(value);
		if (resolved !== undefined) el.setAttribute(attr, resolved);
	};
	root.querySelectorAll(
		'img[src], source[src], video[src], audio[src], track[src]',
	).forEach((el) => rewrite(el, 'src'));
	root.querySelectorAll('video[poster]').forEach((el) =>
		rewrite(el, 'poster'),
	);
	root.querySelectorAll('image[href]').forEach((el) => rewrite(el, 'href'));
}

/** Relative media URLs of a fragment, for collecting files to embed. */
export function mediaUrls(root: ParentNode): string[] {
	const urls: string[] = [];
	resolveMediaUrls(root, (url) => {
		urls.push(url);
		return undefined;
	});
	return urls;
}
