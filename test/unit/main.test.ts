import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from 'obsidian';
import MarpPlugin from '../../src/main';

/** Enough of the app for `onload`, with a layout that becomes ready on demand. */
function fakeApp() {
	const pending: (() => void)[] = [];
	const workspace = Object.assign(new Events(), {
		layoutReady: false,
		onLayoutReady(callback: () => void) {
			if (workspace.layoutReady) callback();
			else pending.push(callback);
		},
	});
	const ready = () => {
		workspace.layoutReady = true;
		for (const callback of pending.splice(0)) callback();
	};
	return { app: { workspace, vault: new Events() }, ready };
}

async function loadPlugin() {
	const { app, ready } = fakeApp();
	const plugin = new MarpPlugin(app as never, {} as never);
	await plugin.saveData({ themeFolder: 'Themes' });
	await plugin.onload();
	const refresh = vi.spyOn(plugin, 'refresh');
	return { plugin, vault: app.vault, ready, refresh };
}

describe('MarpPlugin theme folder watching', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('ignores the create events of the vault load', async () => {
		const { vault, ready, refresh } = await loadPlugin();
		for (const name of ['a', 'b', 'c']) {
			vault.trigger('create', { path: `Themes/${name}.css` });
		}
		ready();
		await vi.runAllTimersAsync();
		expect(refresh).not.toHaveBeenCalled();

		vault.trigger('create', { path: 'Themes/d.css' });
		await vi.runAllTimersAsync();
		expect(refresh).toHaveBeenCalledTimes(1);
	});
});
