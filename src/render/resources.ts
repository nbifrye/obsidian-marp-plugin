import { App, TFile, arrayBufferToBase64, normalizePath } from 'obsidian';
import { isExternalUrl } from './obsidian-images';

const mimeTypes: Record<string, string> = {
	apng: 'image/apng',
	avif: 'image/avif',
	bmp: 'image/bmp',
	gif: 'image/gif',
	ico: 'image/x-icon',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	otf: 'font/otf',
	ttf: 'font/ttf',
	woff: 'font/woff',
	woff2: 'font/woff2',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mp3: 'audio/mpeg',
	ogg: 'audio/ogg',
	wav: 'audio/wav',
};

/** Joins a relative path onto a folder, resolving `.` and `..` segments. */
export function joinPath(folder: string, relative: string): string {
	const parts = folder ? folder.split('/') : [];
	for (const part of relative.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') parts.pop();
		else parts.push(part);
	}
	return parts.join('/');
}

export function parentFolder(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash < 0 ? '' : path.slice(0, slash);
}

function decodeUrlPath(url: string): string {
	const path = url.split(/[?#]/)[0] ?? '';
	try {
		return decodeURI(path);
	} catch {
		return path;
	}
}

/**
 * Finds the vault file a URL in a note or stylesheet refers to. Plain links
 * are relative to `sourcePath` (or the vault root with a leading `/`); embeds
 * and unmatched links fall back to Obsidian's link resolution.
 */
export function findVaultFile(
	app: App,
	url: string,
	sourcePath: string,
	kind: 'link' | 'embed' = 'link',
): TFile | null {
	if (isExternalUrl(url)) return null;
	const path = decodeUrlPath(url);
	if (!path) return null;
	if (kind === 'link') {
		const candidate = normalizePath(
			path.startsWith('/')
				? path.slice(1)
				: joinPath(parentFolder(sourcePath), path),
		);
		const file = app.vault.getAbstractFileByPath(candidate);
		if (file instanceof TFile) return file;
	}
	return app.metadataCache.getFirstLinkpathDest(path, sourcePath);
}

export async function readAsDataUrl(app: App, file: TFile): Promise<string> {
	const mime =
		mimeTypes[file.extension.toLowerCase()] ?? 'application/octet-stream';
	const data = await app.vault.readBinary(file);
	return `data:${mime};base64,${arrayBufferToBase64(data)}`;
}

/**
 * Resolves vault URLs for display inside the app, using resource URLs that
 * change when the file does (so edits to images show up).
 */
export function previewUrl(
	app: App,
	url: string,
	sourcePath: string,
	kind: 'link' | 'embed' = 'link',
): string | undefined {
	const file = findVaultFile(app, url, sourcePath, kind);
	return file ? app.vault.getResourcePath(file) : undefined;
}

/**
 * Origin (scheme and host) of the URLs Obsidian uses for vault files, e.g.
 * `app://<id>` on desktop or `http://localhost` on Android. Used to allow
 * them in the slides' Content Security Policy.
 */
export function vaultResourceOrigin(app: App): string {
	try {
		const url = new URL(app.vault.adapter.getResourcePath('x'));
		return `${url.protocol}//${url.host}`;
	} catch {
		return '';
	}
}
