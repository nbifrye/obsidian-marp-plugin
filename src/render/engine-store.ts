import { Notice } from 'obsidian';
import type MarpPlugin from '../main';
import type { Engine } from './engine';
import { previewUrl } from './resources';
import { readThemeSources, rewriteCssUrls } from './themes';

/**
 * Builds the Marp engine on first use (the renderer module is loaded lazily
 * to keep startup light) and rebuilds it when settings or themes change.
 */
export class EngineStore {
	private engine: Promise<Engine> | undefined;

	constructor(private readonly plugin: MarpPlugin) {}

	get(): Promise<Engine> {
		if (!this.engine) {
			const engine = this.build();
			this.engine = engine;
			// Retry on the next use instead of keeping a failure (e.g. a theme
			// that could not be read).
			engine.catch(() => {
				if (this.engine === engine) this.engine = undefined;
			});
		}
		return this.engine;
	}

	invalidate(): void {
		this.engine = undefined;
	}

	private async build(): Promise<Engine> {
		const { app, settings } = this.plugin;
		const [{ createEngine }, sources] = await Promise.all([
			import('./engine'),
			readThemeSources(app, settings.themeFolder),
		]);
		const engine = createEngine({
			math: settings.math,
			html: settings.html,
			themes: sources.map(({ path, css }) => ({
				path,
				css: rewriteCssUrls(css, (url) => previewUrl(app, url, path)),
			})),
		});
		for (const error of engine.themeErrors) {
			new Notice(`Could not load theme ${error.path}: ${error.message}`);
		}
		return engine;
	}
}
