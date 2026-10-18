import { browser, expect } from '@wdio/globals';
import { obsidianPage } from 'wdio-obsidian-service';
import type { MarpPluginSettings } from '../../src/settings';
import { resetVault } from './helpers';

const PLUGIN_ID = 'sample-plugin';

type PluginManager = {
	plugins: Record<string, { settings?: { mySetting: string } }>;
	disablePlugin(id: string): Promise<void>;
	enablePlugin(id: string): Promise<void>;
};

type SettingModal = {
	open(): void;
	close(): void;
	openTabById(id: string): void;
};

/**
 * Opens this plugin's settings tab and focuses the window that shows it.
 * Desktop Obsidian 1.14+ opens settings in a popout window, while mobile
 * (and older desktop versions) show it as a modal in the main window.
 */
async function openPluginSettings(): Promise<void> {
	const before = await browser.getWindowHandles();
	await browser.executeObsidian(({ app }, id) => {
		const setting = (app as unknown as { setting: SettingModal }).setting;
		setting.open();
		setting.openTabById(id);
	}, PLUGIN_ID);

	let popout: string | undefined;
	await browser.waitUntil(async () => {
		const handles = await browser.getWindowHandles();
		popout = handles.find((h) => !before.includes(h));
		return (
			popout !== undefined ||
			browser.$('.vertical-tab-content').isExisting()
		);
	});
	if (popout) await browser.switchToWindow(popout);
}

/** Closes every tab in the main area. */
async function closeAllTabs(): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		// Collect first: detaching while iterating skips leaves on Obsidian 1.0.
		const leaves: { detach(): void }[] = [];
		app.workspace.iterateRootLeaves((leaf) => {
			leaves.push(leaf);
		});
		for (const leaf of leaves) leaf.detach();
	});
}

describe('Sample plugin', function () {
	// Settings as loaded from a vault without data.json, i.e. the defaults.
	// Read from the running plugin because src/ cannot be imported at runtime
	// here (it depends on the `obsidian` module, which only exists in the app).
	let defaults: MarpPluginSettings;

	before(async function () {
		defaults = await browser.executeObsidian(({ plugins }) =>
			structuredClone(plugins.samplePlugin.settings),
		);
	});

	beforeEach(async function () {
		// Restore the vault files and plugin settings without restarting Obsidian.
		await resetVault();
		await browser.executeObsidian(async ({ plugins }, defaults) => {
			Object.assign(plugins.samplePlugin.settings, defaults);
			await plugins.samplePlugin.saveSettings();
		}, defaults);
		await obsidianPage.openFile('Welcome.md');
	});

	afterEach(async function () {
		// Close whatever a test left open (settings, modals) and all tabs, so
		// the next test starts from a clean workspace in the main window.
		await browser.switchToWindow(await obsidianPage.getMainWindowHandle());
		const settingsOpen =
			(await browser.getWindowHandles()).length > 1 ||
			(await browser.$('.modal.mod-settings').isExisting());
		// Only close settings when shown: calling close() on a closed settings
		// modal breaks the next open() on Obsidian 1.0 mobile.
		if (settingsOpen) {
			await browser.executeObsidian(({ app }) => {
				(app as unknown as { setting: SettingModal }).setting.close();
			});
		}
		for (let i = 0; i < 5; i++) {
			if (!(await browser.$('.modal-container').isExisting())) break;
			await browser.keys('Escape');
		}
		await closeAllTabs();
	});

	it('is loaded and enabled', async function () {
		const enabled = await browser.executeObsidian(
			({ app }, id) =>
				(
					app as unknown as {
						plugins: { enabledPlugins: Set<string> };
					}
				).plugins.enabledPlugins.has(id),
			PLUGIN_ID,
		);
		expect(enabled).toBe(true);
	});

	it('opens the simple modal', async function () {
		await browser.executeObsidianCommand(`${PLUGIN_ID}:open-modal-simple`);
		const modal = browser.$('.modal-container .modal-content');
		await expect(modal).toExist();
		await expect(modal).toHaveText('Woah!');
	});

	it('offers the complex modal only while a note is active', async function () {
		// executeCommandById() reports true even when checkCallback refuses,
		// so ask the command itself whether it is available.
		const available = () =>
			browser.executeObsidian(
				({ app }, id) =>
					(
						app as unknown as {
							commands: {
								findCommand(id: string): {
									checkCallback(checking: boolean): boolean;
								};
							};
						}
					).commands
						.findCommand(id)
						.checkCallback(true),
				`${PLUGIN_ID}:open-modal-complex`,
			);
		expect(await available()).toBe(true);

		await closeAllTabs();
		expect(await available()).toBe(false);
		await browser.executeObsidianCommand(`${PLUGIN_ID}:open-modal-complex`);
		await expect(browser.$('.modal-container')).not.toExist();
	});

	it('replaces the selected text in the editor', async function () {
		await browser.executeObsidian(({ app, obsidian }) => {
			const view = app.workspace.getActiveViewOfType(
				obsidian.MarkdownView,
			);
			if (!view) throw new Error('No active Markdown view');
			const { editor } = view;
			const line = editor.getValue().split('\n').indexOf('Replace me.');
			editor.setSelection(
				{ line, ch: 0 },
				{ line, ch: editor.getLine(line).length },
			);
			editor.focus();
		});
		await browser.executeObsidianCommand(`${PLUGIN_ID}:replace-selected`);

		const content = await browser.executeObsidian(({ app, obsidian }) => {
			const view = app.workspace.getActiveViewOfType(
				obsidian.MarkdownView,
			);
			return view?.editor.getValue();
		});
		expect(content).toContain('Sample editor command');
		expect(content).not.toContain('Replace me.');
	});

	it('adds a ribbon icon', async function () {
		await expect(
			browser.$('.side-dock-ribbon-action[aria-label="Sample"]'),
		).toExist();
	});

	it('adds a status bar item on desktop', async function () {
		const { isMobile } = await obsidianPage.getPlatform();
		if (isMobile) this.skip();
		await expect(browser.$('.status-bar')).toHaveText(
			expect.stringContaining('Status bar text'),
		);
	});

	it('persists changes made in the settings tab', async function () {
		await openPluginSettings();

		const input = browser.$(
			'.vertical-tab-content input[placeholder="Enter your secret"]',
		);
		await expect(input).toHaveValue(defaults.mySetting);
		await input.setValue('from e2e');

		await browser.waitUntil(async () => {
			const saved = await browser.executeObsidian(
				async ({ plugins }) =>
					(await plugins.samplePlugin.loadData()) as {
						mySetting?: string;
					} | null,
			);
			return saved?.mySetting === 'from e2e';
		});
	});

	it('restores settings and removes its commands and listeners on reload', async function () {
		const state = await browser.executeObsidian(async ({ app }, id) => {
			const manager = (app as unknown as { plugins: PluginManager })
				.plugins;
			const commands = () =>
				Object.keys(
					(
						app as unknown as {
							commands: { commands: Record<string, unknown> };
						}
					).commands.commands,
				).filter((c) => c.startsWith(`${id}:`)).length;
			// The plugin shows a "Click" notice from a document click listener.
			const clickNotices = () => {
				document.querySelectorAll('.notice').forEach((n) => n.remove());
				document.body.click();
				return [...document.querySelectorAll('.notice')].filter(
					(n) => n.textContent === 'Click',
				).length;
			};
			const plugin = manager.plugins[id] as unknown as {
				settings: { mySetting: string };
				saveSettings(): Promise<void>;
			};
			plugin.settings.mySetting = 'before reload';
			await plugin.saveSettings();

			await manager.disablePlugin(id);
			const disabled = { commands: commands(), clicks: clickNotices() };
			await manager.enablePlugin(id);

			return {
				disabled,
				enabled: { commands: commands(), clicks: clickNotices() },
				setting: manager.plugins[id]?.settings?.mySetting,
			};
		}, PLUGIN_ID);

		expect(state.disabled).toEqual({ commands: 0, clicks: 0 });
		expect(state.enabled).toEqual({ commands: 3, clicks: 1 });
		expect(state.setting).toBe('before reload');
		await expect(
			browser.$$('.side-dock-ribbon-action[aria-label="Sample"]'),
		).toBeElementsArrayOfSize(1);
	});
});
