import { App, TFile, normalizePath } from 'obsidian';
import { isExternalUrl } from './obsidian-images';

export interface ThemeSource {
	path: string;
	css: string;
}

const cssUrl = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;

export function normalizeFolder(folder: string): string {
	const normalized = normalizePath(folder.trim());
	return normalized === '/' ? '' : normalized;
}

export function isInFolder(path: string, folder: string): boolean {
	const normalized = normalizeFolder(folder);
	return normalized !== '' && path.startsWith(`${normalized}/`);
}

export function isThemeFile(path: string, folder: string): boolean {
	return isInFolder(path, folder) && path.toLowerCase().endsWith('.css');
}

/** Reads every CSS file in the theme folder and its subfolders. */
export async function readThemeSources(
	app: App,
	folder: string,
): Promise<ThemeSource[]> {
	if (!normalizeFolder(folder)) return [];
	const files = app.vault
		.getFiles()
		.filter((file: TFile) => isThemeFile(file.path, folder))
		.sort((a, b) => a.path.localeCompare(b.path));
	return Promise.all(
		files.map(async (file) => ({
			path: file.path,
			css: await app.vault.cachedRead(file),
		})),
	);
}

/**
 * Rewrites the vault-relative `url()`s of a stylesheet (images, fonts).
 * External URLs, data URLs and `@import` targets are kept as written.
 */
export function rewriteCssUrls(
	css: string,
	rewrite: (url: string) => string | undefined,
): string {
	return css.replace(
		cssUrl,
		(match, dq?: string, sq?: string, bare?: string, offset?: number) => {
			const url = dq ?? sq ?? bare ?? '';
			if (!url || isExternalUrl(url)) return match;
			const before = css.slice(Math.max(0, (offset ?? 0) - 32), offset);
			if (/@import\s*$/i.test(before)) return match;
			const replaced = rewrite(url);
			return replaced === undefined ? match : `url("${replaced}")`;
		},
	);
}

/** Lists the vault-relative `url()`s of a stylesheet. */
export function cssUrls(css: string): string[] {
	const urls: string[] = [];
	rewriteCssUrls(css, (url) => {
		urls.push(url);
		return undefined;
	});
	return urls;
}
