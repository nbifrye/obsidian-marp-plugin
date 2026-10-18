import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import MarpPlugin from '../../src/main';
import { DEFAULT_SETTINGS } from '../../src/settings';

function createPlugin(): MarpPlugin {
	return new MarpPlugin(new App(), {} as never);
}

describe('settings', () => {
	it('falls back to defaults when nothing is stored', async () => {
		const plugin = createPlugin();
		await plugin.loadSettings();
		expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps stored values over defaults', async () => {
		const plugin = createPlugin();
		await plugin.saveData({ mySetting: 'stored' });
		await plugin.loadSettings();
		expect(plugin.settings.mySetting).toBe('stored');
	});

	it('round-trips through saveSettings', async () => {
		const plugin = createPlugin();
		await plugin.loadSettings();
		plugin.settings.mySetting = 'changed';
		await plugin.saveSettings();
		plugin.settings.mySetting = 'unsaved';

		await plugin.loadSettings();
		expect(plugin.settings.mySetting).toBe('changed');
	});
});
