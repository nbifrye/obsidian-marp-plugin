// Minimal runtime stand-in for the `obsidian` module, which ships types only.
// Unit tests import it through the alias in vitest.config.mts. Extend it as the
// plugin starts using more of the API; anything that needs the real app belongs
// in the e2e suite instead.

export class App {}

export class Plugin {
	app: App;
	manifest: unknown;
	private data: unknown = null;

	constructor(app: App, manifest: unknown) {
		this.app = app;
		this.manifest = manifest;
	}

	// Stored as a copy, like data.json, so a test that mutates settings
	// without calling saveData() does not see the change persisted.
	async loadData(): Promise<unknown> {
		return structuredClone(this.data);
	}

	async saveData(data: unknown): Promise<void> {
		this.data = structuredClone(data);
	}
}

export class PluginSettingTab {
	app: App;
	containerEl = { empty: () => {} };

	constructor(app: App, _plugin: Plugin) {
		this.app = app;
	}
}

export class Modal {
	app: App;
	contentEl = { setText: (_text: string) => {}, empty: () => {} };

	constructor(app: App) {
		this.app = app;
	}
}

export class Setting {}
export class Notice {}
export class MarkdownView {}

import { parse } from 'yaml';

export function parseYaml(yaml: string): unknown {
	return parse(yaml);
}

export class Events {
	private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
	on(name: string, callback: (...args: unknown[]) => void) {
		this.handlers.set(name, [...(this.handlers.get(name) ?? []), callback]);
		return { name, callback };
	}
	trigger(name: string, ...args: unknown[]) {
		for (const callback of this.handlers.get(name) ?? []) callback(...args);
	}
}

export class ItemView {}
export class TAbstractFile {}
export class TFile extends TAbstractFile {}
export class WorkspaceLeaf {}
export const Platform = { isMobile: false, isDesktopApp: true };
export function setIcon() {}

export function normalizePath(path: string): string {
	return path.replace(/[\\/]+/g, '/').replace(/^\/|\/$/g, '') || '/';
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return Buffer.from(buffer).toString('base64');
}
