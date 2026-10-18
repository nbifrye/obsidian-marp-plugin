import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Settings #1',
				desc: "It's a secret",
				control: {
					type: 'text',
					key: 'mySetting',
					placeholder: 'Enter your secret',
					defaultValue: DEFAULT_SETTINGS.mySetting,
				},
			},
		];
	}

	// Fallback for Obsidian versions older than 1.13.0
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
