import { Platform } from 'obsidian';
import type MarpPlugin from './main';
import {
	exportHtml,
	openPreview,
	printNote,
	startPresentation,
	targetFile,
} from './actions';

export function registerCommands(plugin: MarpPlugin): void {
	plugin.addCommand({
		id: 'open-preview',
		name: 'Open slide preview',
		callback: () => void openPreview(plugin, targetFile(plugin)),
	});

	plugin.addCommand({
		id: 'start-presentation',
		name: 'Start presentation',
		checkCallback: (checking) => {
			const file = targetFile(plugin);
			if (!file) return false;
			if (!checking) void startPresentation(plugin, file);
			return true;
		},
	});

	plugin.addCommand({
		id: 'export-html',
		name: 'Export as HTML',
		checkCallback: (checking) => {
			const file = targetFile(plugin);
			if (!file) return false;
			if (!checking) void exportHtml(plugin, file);
			return true;
		},
	});

	plugin.addCommand({
		id: 'print',
		name: 'Print slides',
		checkCallback: (checking) => {
			const file = targetFile(plugin);
			if (!file || !Platform.isDesktopApp) return false;
			if (!checking) void printNote(plugin, file);
			return true;
		},
	});
}
