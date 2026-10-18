import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import MarpPlugin from '../../src/main';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/settings';

function createPlugin(): MarpPlugin {
	return new MarpPlugin(new App(), {} as never);
}

describe('settings', () => {
	it('falls back to defaults when nothing is stored', async () => {
		const plugin = createPlugin();
		await plugin.loadSettings();
		expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
	});

	it('defaults to MathJax, the HTML allowlist and loading external resources', () => {
		expect(DEFAULT_SETTINGS).toEqual({
			math: 'mathjax',
			html: 'allowlist',
			themeFolder: '',
			blockExternalResources: false,
		});
	});

	it('keeps valid stored values and drops invalid ones', () => {
		expect(
			normalizeSettings({
				math: 'katex',
				html: 'nonsense',
				themeFolder: 'Themes',
				blockExternalResources: 'yes',
				mySetting: 'old',
			}),
		).toEqual({
			...DEFAULT_SETTINGS,
			math: 'katex',
			themeFolder: 'Themes',
		});
	});

	it('round-trips through saveSettings', async () => {
		const plugin = createPlugin();
		await plugin.loadSettings();
		plugin.settings.html = 'off';
		await plugin.saveSettings();
		plugin.settings.html = 'all';

		await plugin.loadSettings();
		expect(plugin.settings.html).toBe('off');
	});

	it('notifies open previews when settings are saved', async () => {
		const plugin = createPlugin();
		await plugin.loadSettings();
		let refreshed = 0;
		plugin.events.on('refresh', () => refreshed++);
		await plugin.saveSettings();
		expect(refreshed).toBe(1);
	});
});
