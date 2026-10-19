import { Events, Plugin, TAbstractFile } from 'obsidian';
import { openPreview, targetFile } from './actions';
import { registerCommands } from './commands';
import { buildCsp } from './render/csp';
import { EngineStore } from './render/engine-store';
import { vaultResourceOrigin } from './render/resources';
import { isThemeFile } from './render/themes';
import {
	MarpPluginSettings,
	MarpSettingTab,
	normalizeSettings,
} from './settings';
import { registerFileMenu } from './ui/menus';
import { PREVIEW_VIEW_TYPE, PreviewView } from './ui/preview-view';

export default class MarpPlugin extends Plugin {
	settings!: MarpPluginSettings;
	/** Triggers `refresh` when previews must render again from scratch. */
	readonly events = new Events();
	readonly engines = new EngineStore(this);

	async onload() {
		await this.loadSettings();

		this.registerView(
			PREVIEW_VIEW_TYPE,
			(leaf) => new PreviewView(leaf, this),
		);
		this.addRibbonIcon('presentation', 'Open slide preview', () => {
			void openPreview(this, targetFile(this));
		});
		registerCommands(this);
		registerFileMenu(this);
		this.addSettingTab(new MarpSettingTab(this.app, this));

		const onThemeChange = (file: TAbstractFile, oldPath?: string) => {
			const folder = this.settings.themeFolder;
			if (
				isThemeFile(file.path, folder) ||
				(oldPath !== undefined && isThemeFile(oldPath, folder))
			) {
				this.refresh();
			}
		};
		this.registerEvent(
			this.app.vault.on('create', (f) => onThemeChange(f)),
		);
		this.registerEvent(
			this.app.vault.on('modify', (f) => onThemeChange(f)),
		);
		this.registerEvent(
			this.app.vault.on('delete', (f) => onThemeChange(f)),
		);
		this.registerEvent(this.app.vault.on('rename', onThemeChange));
	}

	async loadSettings() {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refresh();
	}

	/** Rebuilds the engine and re-renders open previews. */
	refresh(): void {
		this.engines.invalidate();
		this.events.trigger('refresh');
	}

	/** CSP for documents that show slides inside the app. */
	csp(): string {
		return buildCsp({
			blockExternalResources: this.settings.blockExternalResources,
			resourceOrigin: vaultResourceOrigin(this.app),
		});
	}
}
