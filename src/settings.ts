import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';
import type MarpPlugin from './main';

export type MathEngine = 'mathjax' | 'katex';
export type HtmlMode = 'off' | 'allowlist' | 'all';

export interface MarpPluginSettings {
	/** Math engine used unless the document's `math` directive picks one. */
	math: MathEngine;
	html: HtmlMode;
	/** Vault folder whose CSS files are registered as custom themes. */
	themeFolder: string;
	/** Block HTTP(S) resources referenced by documents and themes. */
	blockExternalResources: boolean;
}

export const DEFAULT_SETTINGS: MarpPluginSettings = {
	math: 'mathjax',
	html: 'allowlist',
	themeFolder: '',
	blockExternalResources: false,
};

const mathOptions: Record<MathEngine, string> = {
	mathjax: 'MathJax',
	katex: 'KaTeX',
};

const htmlOptions: Record<HtmlMode, string> = {
	off: 'Off',
	allowlist: 'Safe elements only',
	all: 'All elements',
};

const text = {
	math: {
		name: 'Math engine',
		desc: 'Used when a note does not set the math directive.',
	},
	html: {
		name: 'HTML in Markdown',
		desc: 'Which HTML elements written in notes are rendered. JavaScript never runs.',
		warning:
			'All elements: notes can embed any HTML and styles. JavaScript still never runs.',
	},
	themeFolder: {
		name: 'Theme folder',
		desc: 'Vault folder with custom theme CSS files. Leave empty to use only the built-in themes.',
	},
	blockExternalResources: {
		name: 'Block external resources',
		desc: 'Images, fonts and styles from the internet that notes and themes refer to are loaded by default, which sends your IP address to those servers. Turn on to block them.',
	},
};

/** Parses stored data, dropping values that are not valid settings. */
export function normalizeSettings(data: unknown): MarpPluginSettings {
	const stored = (data && typeof data === 'object' ? data : {}) as Partial<
		Record<keyof MarpPluginSettings, unknown>
	>;
	const settings = { ...DEFAULT_SETTINGS };
	if (stored.math === 'mathjax' || stored.math === 'katex') {
		settings.math = stored.math;
	}
	if (
		stored.html === 'off' ||
		stored.html === 'allowlist' ||
		stored.html === 'all'
	) {
		settings.html = stored.html;
	}
	if (typeof stored.themeFolder === 'string') {
		settings.themeFolder = stored.themeFolder;
	}
	if (typeof stored.blockExternalResources === 'boolean') {
		settings.blockExternalResources = stored.blockExternalResources;
	}
	return settings;
}

export class MarpSettingTab extends PluginSettingTab {
	plugin: MarpPlugin;

	constructor(app: App, plugin: MarpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Persist through the plugin so open previews pick up the change.
	async setControlValue(key: string, value: unknown): Promise<void> {
		this.plugin.settings = normalizeSettings({
			...this.plugin.settings,
			[key]: value,
		});
		await this.plugin.saveSettings();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				...text.math,
				control: {
					type: 'dropdown',
					key: 'math',
					options: mathOptions,
					defaultValue: DEFAULT_SETTINGS.math,
				},
			},
			{
				...text.html,
				control: {
					type: 'dropdown',
					key: 'html',
					options: htmlOptions,
					defaultValue: DEFAULT_SETTINGS.html,
				},
			},
			{
				name: text.html.warning,
				visible: () => this.plugin.settings.html === 'all',
			},
			{
				...text.themeFolder,
				control: {
					type: 'folder',
					key: 'themeFolder',
					defaultValue: DEFAULT_SETTINGS.themeFolder,
				},
			},
			{
				...text.blockExternalResources,
				control: {
					type: 'toggle',
					key: 'blockExternalResources',
					defaultValue: DEFAULT_SETTINGS.blockExternalResources,
				},
			},
		];
	}

	// Fallback for Obsidian versions older than 1.13.0
	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;

		containerEl.empty();

		new Setting(containerEl)
			.setName(text.math.name)
			.setDesc(text.math.desc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(mathOptions)
					.setValue(settings.math)
					.onChange(async (value) => {
						settings.math = value as MathEngine;
						await this.plugin.saveSettings();
					}),
			);

		const warning = containerEl.createDiv({
			cls: 'marp-core-slides-setting-warning',
			text: text.html.warning,
		});
		const html = new Setting(containerEl)
			.setName(text.html.name)
			.setDesc(text.html.desc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(htmlOptions)
					.setValue(settings.html)
					.onChange(async (value) => {
						settings.html = value as HtmlMode;
						warning.toggle(settings.html === 'all');
						await this.plugin.saveSettings();
					}),
			);
		html.settingEl.after(warning);
		warning.toggle(settings.html === 'all');

		new Setting(containerEl)
			.setName(text.themeFolder.name)
			.setDesc(text.themeFolder.desc)
			.addText((input) =>
				input
					.setPlaceholder('Themes')
					.setValue(settings.themeFolder)
					.onChange(async (value) => {
						settings.themeFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(text.blockExternalResources.name)
			.setDesc(text.blockExternalResources.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.blockExternalResources)
					.onChange(async (value) => {
						settings.blockExternalResources = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
