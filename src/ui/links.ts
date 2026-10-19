import { App } from 'obsidian';
import { findVaultFile } from '../render/resources';

/**
 * Handles a link clicked in the slides. Web and mail links open outside the
 * app, vault links open in Obsidian and `#<n>` jumps to slide n; anything
 * else (such as `javascript:`) is ignored.
 */
export function openSlideLink(
	app: App,
	href: string,
	sourcePath: string,
	goToSlide?: (index: number) => void,
): void {
	const url = href.trim();
	if (url.startsWith('#')) {
		const page = Number.parseInt(url.slice(1), 10);
		if (Number.isInteger(page) && page > 0) goToSlide?.(page - 1);
		return;
	}
	if (/^(?:https?|mailto):/i.test(url)) {
		window.open(url, '_blank', 'noopener');
		return;
	}
	if (/^[a-z][a-z\d+.-]*:/i.test(url)) return;
	const file = findVaultFile(app, url, sourcePath);
	if (file) void app.workspace.openLinkText(file.path, sourcePath);
}
