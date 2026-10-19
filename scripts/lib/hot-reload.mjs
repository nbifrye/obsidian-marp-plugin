// Installs pjeby/hot-reload (https://github.com/pjeby/hot-reload) into a
// vault, so a plugin is reloaded whenever its main.js or styles.css changes.
//
// The release is pinned and its files are checked against known hashes, then
// cached in .obsidian-cache/ so later installs work offline.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { root } from './session.mjs';

export const hotReloadId = 'hot-reload';
const version = '0.3.1';
const files = {
	'main.js':
		'41e1aa3841c08fe789160fae73f24b723d30e18f9ed5cda55c49110ce02d7601',
	'manifest.json':
		'62bab306528e1ba54382417f1cb6b78ae1e4e9a00e3169b812818949273d32f8',
};
const cacheDir = path.join(root, '.obsidian-cache', `hot-reload-${version}`);

function sha256(data) {
	return createHash('sha256').update(data).digest('hex');
}

async function fetchFile(name) {
	const cached = path.join(cacheDir, name);
	const data = await fs.readFile(cached).catch((e) => {
		if (e.code !== 'ENOENT') throw e;
		return null;
	});
	if (data && sha256(data) === files[name]) return data;

	const url = `https://github.com/pjeby/hot-reload/releases/download/${version}/${name}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
	const body = Buffer.from(await res.arrayBuffer());
	if (sha256(body) !== files[name]) {
		throw new Error(`${url}: unexpected SHA-256 ${sha256(body)}`);
	}
	await fs.mkdir(cacheDir, { recursive: true });
	await fs.writeFile(cached, body);
	return body;
}

/**
 * Installs and enables Hot Reload in the vault whose config folder is
 * `configDir`, and marks the plugin in `pluginDir` for hot reloading.
 */
export async function installHotReload(configDir, pluginDir) {
	const dir = path.join(configDir, 'plugins', hotReloadId);
	await fs.mkdir(dir, { recursive: true });
	for (const name of Object.keys(files)) {
		await fs.writeFile(path.join(dir, name), await fetchFile(name));
	}
	await fs.writeFile(path.join(pluginDir, '.hotreload'), '');

	const listFile = path.join(configDir, 'community-plugins.json');
	const enabled = JSON.parse(
		await fs.readFile(listFile, 'utf8').catch((e) => {
			if (e.code !== 'ENOENT') throw e;
			return '[]';
		}),
	);
	if (!enabled.includes(hotReloadId)) {
		enabled.push(hotReloadId);
		await fs.writeFile(listFile, JSON.stringify(enabled, null, '\t'));
	}
}
