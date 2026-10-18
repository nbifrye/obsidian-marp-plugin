import type MarpPlugin from '../../src/main';

declare module 'wdio-obsidian-service' {
	interface InstalledPlugins {
		marpDeck: MarpPlugin;
	}
}
