// Shared by obsidian-launch.mjs and obsidian-cdp.mjs. Calls here have no
// timeouts of their own: each script puts one deadline on its whole run.
//
// A session is one Obsidian process started by obsidian-launch.mjs. It is
// recorded in .obsidian-cache/sessions/<pid>.json with the DevTools browser
// URL that the process itself announced, so a session is identified by the
// process rather than by a port number that another app could also use.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import CDP from 'chrome-remote-interface';

export const root = path.resolve(import.meta.dirname, '..', '..');
export const sessionsDir = path.join(root, '.obsidian-cache', 'sessions');
export const pluginId = JSON.parse(
	await fs.readFile(path.join(root, 'manifest.json'), 'utf8'),
).id;

export function sessionFile(pid) {
	return path.join(sessionsDir, `${pid}.json`);
}

function isAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return e.code === 'EPERM';
	}
}

/**
 * Copies the built plugin into a vault's plugin folder. Copies, not the
 * launcher's install, which hard-links the files: a write in the sandbox
 * (even a chmod) would then change this repo's manifest.json or styles.css.
 */
export async function copyPlugin(pluginDir) {
	await fs.mkdir(pluginDir, { recursive: true });
	for (const name of ['main.js', 'manifest.json', 'styles.css']) {
		const dest = path.join(pluginDir, name);
		await fs.copyFile(path.join(root, name), dest).catch((e) => {
			if (e.code !== 'ENOENT' || name !== 'styles.css') throw e;
			// styles.css is optional: drop a stale copy too.
			return fs.rm(dest, { force: true });
		});
	}
}

/** Sessions whose Obsidian process is still running. */
export async function liveSessions() {
	let names;
	try {
		names = await fs.readdir(sessionsDir);
	} catch (e) {
		if (e.code === 'ENOENT') return [];
		throw e;
	}
	const sessions = [];
	for (const name of names.filter((n) => n.endsWith('.json'))) {
		const session = JSON.parse(
			await fs.readFile(path.join(sessionsDir, name), 'utf8'),
		);
		if (isAlive(session.pid)) sessions.push(session);
	}
	return sessions;
}

/** Evaluates `expression` (awaited) in a page and returns the value. */
export async function evaluate(client, expression) {
	const { result, exceptionDetails } = await client.Runtime.evaluate({
		expression,
		awaitPromise: true,
		returnByValue: true,
		userGesture: true,
	});
	if (exceptionDetails) {
		throw new Error(
			exceptionDetails.exception?.description ?? exceptionDetails.text,
		);
	}
	return result.value;
}

/** Runs `fn` with a client attached to one page target. */
export async function withPage(session, targetId, fn) {
	const client = await CDP({ target: targetId, port: session.port });
	try {
		return await fn(client);
	} finally {
		await client.close();
	}
}

const VAULT_PATH = `typeof app === 'undefined' ? null : app.vault.adapter.getBasePath?.() ?? null`;

/**
 * Lists the windows that belong to the session: main windows with the
 * session's vault open, and windows opened from them (popouts such as the
 * settings window on desktop 1.14+, which have no `app` of their own).
 * Every target is checked individually, so a window of another vault in the
 * same process is never returned.
 */
export async function sessionPages(session) {
	// The browser URL carries a per-process id: connecting fails if the port
	// now belongs to a different process.
	const browser = await CDP({ target: session.browserUrl });
	let pages;
	try {
		const { targetInfos } = await browser.Target.getTargets();
		pages = targetInfos.filter((t) => t.type === 'page');
	} finally {
		await browser.close();
	}

	const owned = new Set();
	for (const page of pages) {
		const vault = await withPage(session, page.targetId, (c) =>
			evaluate(c, VAULT_PATH),
		).catch(() => null);
		if (vault && path.resolve(vault) === path.resolve(session.vault)) {
			owned.add(page.targetId);
		}
	}
	for (let grew = true; grew;) {
		grew = false;
		for (const page of pages) {
			if (!owned.has(page.targetId) && owned.has(page.openerId)) {
				owned.add(page.targetId);
				grew = true;
			}
		}
	}
	return pages
		.filter((p) => owned.has(p.targetId))
		.map((p) => ({ ...p, main: !p.openerId }));
}

/**
 * Expression that (re)loads the plugin and resolves only after its onload()
 * has finished. A copy that is already loaded is unloaded first. Obsidian registers the instance in `app.plugins.plugins`
 * before calling load(), and Obsidian 1.0 does not await an async onload(),
 * so neither the registry nor enablePlugin() tells when loading is done.
 * Catching the instance as it is registered lets us await onload() itself.
 */
export function enablePluginExpression(id = pluginId) {
	return `(async () => {
		const id = ${JSON.stringify(id)};
		const manager = app.plugins;
		await manager.disablePlugin(id);
		const registry = manager.plugins;
		let instance, original, done;
		manager.plugins = new Proxy(registry, {
			set(target, key, value) {
				if (key === id && value && !instance) {
					instance = value;
					original = Object.getOwnPropertyDescriptor(value, 'onload');
					const onload = value.onload;
					value.onload = function (...args) {
						const result = onload.apply(this, args);
						done = Promise.resolve(result);
						return result;
					};
				}
				target[key] = value;
				return true;
			},
		});
		try {
			await manager.enablePluginAndSave(id);
		} finally {
			manager.plugins = registry;
			if (instance) {
				if (original) Object.defineProperty(instance, 'onload', original);
				else delete instance.onload;
			}
		}
		if (!done) throw new Error('Obsidian did not load ' + id);
		await done;
		return true;
	})()`;
}
