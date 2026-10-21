import { Menu, Platform, TFile } from 'obsidian';
import {
	exportHtml,
	openPreview,
	printNote,
	startPresentation,
} from '../actions';
import type MarpPlugin from '../main';
import { isMarpNote } from '../render/note';

/** Options for the presentation, export and print items. */
export interface SlideMenuOptions {
	/** Slide to start the presentation from. */
	start?: () => number;
	/** Whether to include "Open slide preview". */
	preview?: boolean;
}

/** Adds the slide actions for `file` to a menu. */
export function addSlideMenuItems(
	menu: Menu,
	plugin: MarpPlugin,
	file: TFile,
	{ start, preview = true }: SlideMenuOptions = {},
): void {
	if (preview) {
		menu.addItem((item) =>
			item
				.setSection('action')
				.setTitle('Open slide preview')
				.setIcon('presentation')
				.onClick(() => void openPreview(plugin, file)),
		);
	}
	menu.addItem((item) =>
		item
			.setSection('action')
			.setTitle('Start presentation')
			.setIcon('play')
			.onClick(
				() => void startPresentation(plugin, file, start?.() ?? 0),
			),
	);
	menu.addItem((item) =>
		item
			.setSection('action')
			.setTitle('Export as HTML')
			.setIcon('download')
			.onClick(() => void exportHtml(plugin, file)),
	);
	if (Platform.isDesktopApp) {
		menu.addItem((item) =>
			item
				.setSection('action')
				.setTitle('Print slides')
				.setIcon('printer')
				.onClick(() => void printNote(plugin, file)),
		);
	}
}

/**
 * Adds the slide actions to the file menu of Marp notes: the file explorer's
 * context menu, the note's "More options" menu and its tab header menu.
 */
export function registerFileMenu(plugin: MarpPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			if (file instanceof TFile && isMarpNote(plugin.app, file)) {
				addSlideMenuItems(menu, plugin, file);
			}
		}),
	);
}
