// Creates a vault for trying the plugin by hand, e.g. on a phone or tablet:
// a copy of test/vaults/manual with the built plugin installed and enabled.
//
// Usage: node scripts/sample-vault.mjs [--reset] [dir]   (default: sample-vault)
//
// If the vault already exists, only the plugin files are updated, so notes
// and settings changed while testing are kept. --reset recreates the vault;
// it only deletes a folder this script created.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { copyPlugin, pluginId, root } from './lib/session.mjs';

const source = path.join(root, 'test', 'vaults', 'manual');
const marker = '.marp-sample-vault';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const dir = path.resolve(
	args.find((a) => !a.startsWith('--')) ?? path.join(root, 'sample-vault'),
);
const configDir = path.join(dir, '.obsidian');
const pluginDir = path.join(configDir, 'plugins', pluginId);

async function exists(p) {
	return fs.access(p).then(
		() => true,
		() => false,
	);
}

if (reset && (await exists(dir))) {
	if (!(await exists(path.join(dir, marker)))) {
		console.error(`Not deleting ${dir}: it was not created by this script`);
		process.exit(1);
	}
	await fs.rm(dir, { recursive: true });
}

if (await exists(dir)) {
	if (!(await exists(path.join(dir, marker)))) {
		console.error(`${dir} exists and was not created by this script`);
		process.exit(1);
	}
	await copyPlugin(pluginDir);
	console.log(`Updated the plugin in ${dir}`);
} else {
	await fs.cp(source, dir, { recursive: true });
	await fs.writeFile(path.join(dir, marker), '');
	await copyPlugin(pluginDir);
	await fs.writeFile(
		path.join(configDir, 'community-plugins.json'),
		JSON.stringify([pluginId], null, '\t'),
	);
	await fs.writeFile(
		path.join(pluginDir, 'data.json'),
		JSON.stringify({ themeFolder: 'themes' }, null, '\t'),
	);
	console.log(`Created ${dir}`);
}
