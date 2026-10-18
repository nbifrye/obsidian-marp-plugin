import { App, PluginSettingTab, Setting } from 'obsidian';
import MarpPlugin from './main';

export interface MarpPluginSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: MarpPluginSettings = {
	mySetting: 'default',
};

export class MarpSettingTab extends PluginSettingTab {
	plugin: MarpPlugin;

	constructor(app: App, plugin: MarpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
