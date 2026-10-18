import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { browser } from '@wdio/globals';
import { obsidianPage } from 'wdio-obsidian-service';

/**
 * Restores the vault files to the test vault's original state without
 * restarting Obsidian, leaving the config dir (.obsidian) alone.
 *
 * Use this instead of `obsidianPage.resetVault()`: in wdio-obsidian-service
 * 3.3.0 that lists the top-level `.obsidian` folder as an ordinary vault folder
 * and deletes it, which removes the installed plugins and makes every later
 * `saveData()` fail silently.
 */
export async function resetVault(): Promise<void> {
	const source = (browser.requestedCapabilities as WebdriverIO.Capabilities)[
		'wdio:obsidianOptions'
	]?.vault;
	if (!source) throw new Error('No vault configured in wdio:obsidianOptions');

	const wanted = new Map<string, ArrayBuffer>();
	for (const entry of await fs.readdir(source, {
		recursive: true,
		withFileTypes: true,
	})) {
		if (!entry.isFile()) continue;
		const full = path.join(entry.parentPath, entry.name);
		const rel = path.relative(source, full).split(path.sep).join('/');
		if (rel.startsWith('.obsidian/')) continue;
		const data = await fs.readFile(full);
		wanted.set(
			rel,
			data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength,
			),
		);
	}

	const existing = await browser.executeObsidian(async ({ app }) => {
		const configDir = app.vault.configDir;
		const files: string[] = [];
		const folders: string[] = [];
		const walk = async (dir: string) => {
			const listed = await app.vault.adapter.list(dir);
			for (const folder of listed.folders) {
				if (folder === configDir) continue;
				folders.push(folder);
				await walk(folder);
			}
			files.push(...listed.files);
		};
		await walk('/');
		return { files, folders };
	});

	for (const file of existing.files) {
		if (!wanted.has(file)) await obsidianPage.delete(file);
	}
	for (const folder of existing.folders.sort().reverse()) {
		const keep = [...wanted.keys()].some((f) => f.startsWith(`${folder}/`));
		if (!keep) await obsidianPage.delete(folder);
	}
	for (const [file, content] of wanted) {
		await obsidianPage.write(file, content);
	}
}
