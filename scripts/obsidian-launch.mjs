// Launches a sandboxed Obsidian with this plugin installed into a temporary
// copy of the test vault, exposing the Chrome DevTools Protocol so that
// scripts/obsidian-cdp.mjs (or any CDP client) can drive it.
//
// The user's own Obsidian installation, config and vaults are never touched.
// The vault copy, config dir and session record are removed on normal exit,
// on SIGINT/SIGTERM and on failures this script catches; the exit code is
// non-zero if that cleanup fails. Temporary files the launcher creates before
// launch() returns, or anything after a SIGKILL of this script, can remain.
//
// Prints "Obsidian ready" once the plugin's onload() has finished, or exits
// non-zero if that does not happen within READY_TIMEOUT of starting Obsidian.
// Several sessions can run at once; each gets its own CDP port unless one is
// given.
//
// Environment:
//   OBSIDIAN_VERSION     app version (default: latest)
//   OBSIDIAN_INSTALLER   installer version (default: latest)
//   OBSIDIAN_VAULT       vault to copy (default: test/vaults/simple)
//   OBSIDIAN_DEBUG_PORT  CDP port (default: a free port chosen by Obsidian)
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import ObsidianLauncher from 'obsidian-launcher';
import {
	copyPlugin,
	enablePluginExpression,
	evaluate,
	pluginId,
	root,
	sessionFile,
	sessionPages,
	sessionsDir,
	withPage,
} from './lib/session.mjs';

const READY_TIMEOUT = 120_000;
const STOP_TIMEOUT = 5_000;

// Cleanup steps for everything acquired so far, run in reverse order. Each
// resource registers its step as soon as it exists, so a failure at any
// point releases exactly what was created before it.
const cleanups = [];
let proc;
let exited;
let ready = false;
let watchdog;
let stopping = false;

/** Resolves true once Obsidian has exited, or false after `ms`. */
function waitForExit(ms) {
	return Promise.race([
		exited.then(() => true),
		new Promise((r) => setTimeout(() => r(false), ms)),
	]);
}

/** Stops Obsidian, forcing it if needed; false if it is still running. */
async function stopObsidian() {
	if (!proc || proc.exitCode !== null || proc.signalCode !== null)
		return true;
	proc.kill('SIGTERM');
	if (await waitForExit(STOP_TIMEOUT)) return true;
	console.error(`Obsidian did not exit; killing pid ${proc.pid}`);
	proc.kill('SIGKILL');
	return waitForExit(STOP_TIMEOUT);
}

async function shutdown(code, message) {
	if (stopping) return;
	stopping = true;
	if (message) console.error(message);
	if (!(await stopObsidian())) code ||= 1;
	for (const cleanup of cleanups.reverse()) {
		await cleanup().catch((e) => {
			console.error(`Cleanup failed: ${e}`);
			code ||= 1;
		});
	}
	process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => void shutdown(0));
}

const removeDir = (dir) => () =>
	// Windows can keep files locked for a moment after the process exits.
	fs.rm(dir, {
		recursive: true,
		force: true,
		maxRetries: 5,
		retryDelay: 200,
	});

/** Starts Obsidian and resolves with the session it belongs to. */
async function start() {
	const source = path.resolve(
		root,
		process.env.OBSIDIAN_VAULT ?? 'test/vaults/simple',
	);
	// Copy the vault here rather than with the launcher's `copy` option, which
	// keeps symlinks: a symlinked .obsidian would let the plugin install write
	// into the original config.
	const vault = await fs.mkdtemp(
		path.join(os.tmpdir(), `${path.basename(source)}-`),
	);
	cleanups.push(removeDir(vault));
	await fs.cp(source, vault, { recursive: true, dereference: true });
	await copyPlugin(path.join(vault, '.obsidian', 'plugins', pluginId));
	// Left disabled at startup and enabled once Obsidian is up, so that the
	// end of onload() can be observed (see enablePluginExpression).
	const enabledList = path.join(vault, '.obsidian', 'community-plugins.json');
	const enabled = await fs
		.readFile(enabledList, 'utf8')
		.then(JSON.parse, () => null);
	if (Array.isArray(enabled) && enabled.includes(pluginId)) {
		await fs.writeFile(
			enabledList,
			JSON.stringify(enabled.filter((id) => id !== pluginId)),
		);
	}

	const launcher = new ObsidianLauncher({
		cacheDir: path.join(root, '.obsidian-cache'),
	});
	const launched = await launcher.launch({
		appVersion: process.env.OBSIDIAN_VERSION ?? 'latest',
		installerVersion: process.env.OBSIDIAN_INSTALLER ?? 'latest',
		vault,
		// Port 0 lets Obsidian pick a free port, which it then announces.
		args: [
			`--remote-debugging-port=${process.env.OBSIDIAN_DEBUG_PORT ?? 0}`,
		],
		spawnOptions: { stdio: ['ignore', 'ignore', 'pipe'] },
	});
	proc = launched.proc;
	cleanups.push(removeDir(launched.configDir));
	exited = new Promise((resolve) => {
		proc.on('exit', (code, signal) => resolve({ code, signal }));
		// Spawning can fail without an 'exit' event.
		proc.on('error', (error) => resolve({ error }));
	});
	void exited.then(({ code, signal, error }) => {
		if (stopping) return;
		const how = error?.message ?? signal ?? `code ${code}`;
		// Before "ready" any exit is a failed start, even with code 0.
		if (!ready)
			return shutdown(1, `Obsidian exited while starting (${how})`);
		if (code !== 0) return shutdown(1, `Obsidian exited (${how})`);
		return shutdown(0);
	});
	// One deadline for the whole start; ends any CDP call still hanging.
	watchdog = setTimeout(
		() =>
			void shutdown(
				1,
				`Obsidian was not ready within ${READY_TIMEOUT} ms`,
			),
		READY_TIMEOUT,
	);

	// Only the process that bound the port prints this, and the URL carries a
	// per-process id, so it cannot point at some other app on the same port.
	const browserUrl = await new Promise((resolve) => {
		let output = '';
		// Keeps draining stderr after the match so Obsidian never blocks.
		proc.stderr.on('data', (chunk) => {
			output += chunk;
			const url = output.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
			if (url) resolve(url);
		});
	});
	return {
		pid: proc.pid,
		port: Number(new URL(browserUrl).port),
		browserUrl,
		vault,
		configDir: launched.configDir,
	};
}

/** Waits for the vault window, then enables the plugin and awaits onload. */
async function enablePlugin(session) {
	const loaded = `!!app.workspace?.layoutReady && !!app.plugins?.manifests?.[${JSON.stringify(pluginId)}]`;
	while (!stopping) {
		const main = (await sessionPages(session).catch(() => [])).find(
			(p) => p.main,
		);
		if (main) {
			const enabled = await withPage(
				session,
				main.targetId,
				async (c) => {
					if (!(await evaluate(c, loaded))) return false;
					return evaluate(c, enablePluginExpression());
				},
			);
			if (enabled) return;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
}

let session;
try {
	session = await start();
	await enablePlugin(session);
	await fs.mkdir(sessionsDir, { recursive: true });
	const file = sessionFile(session.pid);
	await fs.writeFile(file, JSON.stringify(session, null, 2));
	cleanups.push(() => fs.rm(file, { force: true }));
	clearTimeout(watchdog);
	ready = true;
} catch (e) {
	await shutdown(1, e instanceof Error ? e.message : String(e));
}

if (!stopping) {
	console.log(`Obsidian ready (pid ${session.pid})`);
	console.log(`  vault:      ${session.vault}`);
	console.log(`  config dir: ${session.configDir}`);
	console.log(`  CDP:        http://127.0.0.1:${session.port}`);
	console.log('Press Ctrl+C to quit.');
}
