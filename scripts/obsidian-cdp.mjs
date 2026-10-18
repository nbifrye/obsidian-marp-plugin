// Drives an Obsidian instance started by scripts/obsidian-launch.mjs over the
// Chrome DevTools Protocol.
//
// Usage: node scripts/obsidian-cdp.mjs [options] <command> [args]
//   targets                 list the session's windows (the settings window is a popout on desktop)
//   eval <expression>       evaluate JS (awaited) and print the result as JSON;
//                           `app` is available as a global
//   command <id>            run an Obsidian command, e.g. sample-plugin:open-preview
//   screenshot [file]       save a PNG (default: test-results/screenshots/cdp-<time>.png)
//   reload                  copy the fresh build into the vault and re-enable the plugin,
//                           returning after its onload() has finished
//   logs [seconds]          print console output and errors for a while (default: 5)
//
// Options:
//   --session <pid>         pick a session when several are running
//   --window <text>         use the window whose title or URL contains <text>
//                           (default: the vault's main window)
//
// Only windows that belong to a session recorded by obsidian-launch.mjs are
// ever used (see sessionPages), so this never drives another Obsidian.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
	copyPlugin,
	enablePluginExpression,
	evaluate,
	liveSessions,
	pluginId,
	root,
	sessionPages,
	withPage,
} from './lib/session.mjs';

const argv = process.argv.slice(2);
const option = (name) => {
	const i = argv.indexOf(name);
	if (i === -1) return undefined;
	return argv.splice(i, 2)[1];
};
const sessionPid = option('--session');
const windowFilter = option('--window');
const [command, ...rest] = argv;

async function pickSession() {
	const sessions = await liveSessions();
	if (sessionPid) {
		const match = sessions.find((s) => String(s.pid) === sessionPid);
		if (!match)
			throw new Error(`No running session with pid ${sessionPid}`);
		return match;
	}
	if (sessions.length === 0) {
		throw new Error(
			'No running session; start one with `npm run obsidian:launch` and wait for "Obsidian ready"',
		);
	}
	if (sessions.length > 1) {
		throw new Error(
			`Several sessions are running; pick one with --session <pid>: ${sessions.map((s) => s.pid).join(', ')}`,
		);
	}
	return sessions[0];
}

async function pickPage(session, filter = windowFilter) {
	const pages = await sessionPages(session);
	const page = filter
		? pages.find((p) => p.title.includes(filter) || p.url.includes(filter))
		: pages.find((p) => p.main);
	if (!page) {
		throw new Error(
			filter
				? `No window of this session matches "${filter}"`
				: 'The vault window of this session is not open',
		);
	}
	return page;
}

async function withClient(fn, filter) {
	const session = await pickSession();
	const page = await pickPage(session, filter);
	return withPage(session, page.targetId, fn);
}

const commands = {
	async targets() {
		const session = await pickSession();
		for (const p of await sessionPages(session)) {
			console.log(`${p.main ? 'main' : 'popout'}\t${p.title}\t${p.url}`);
		}
	},

	async eval(expression) {
		if (!expression) throw new Error('eval needs an expression');
		const value = await withClient((c) =>
			evaluate(c, `(async () => (${expression}))()`),
		);
		console.log(JSON.stringify(value, null, 2));
	},

	async command(id) {
		if (!id) throw new Error('command needs a command id');
		const ok = await withClient((c) =>
			evaluate(
				c,
				`app.commands.executeCommandById(${JSON.stringify(id)})`,
			),
		);
		// False only for an unknown id; a command whose check refuses still
		// returns true, so verify its effect separately.
		if (!ok) throw new Error(`Command "${id}" not found`);
		console.log(`Dispatched ${id}`);
	},

	async screenshot(file) {
		const out =
			file ??
			path.join(
				root,
				'test-results',
				'screenshots',
				`cdp-${Date.now()}.png`,
			);
		const { data } = await withClient((c) =>
			c.Page.captureScreenshot({ format: 'png' }),
		);
		await fs.mkdir(path.dirname(out), { recursive: true });
		await fs.writeFile(out, Buffer.from(data, 'base64'));
		console.log(out);
	},

	async reload() {
		// Always the vault window: popouts have no `app` of their own.
		await withClient(async (c) => {
			const pluginDir = await evaluate(
				c,
				`app.vault.adapter.getFullPath(app.vault.configDir + '/plugins/' + ${JSON.stringify(pluginId)})`,
			);
			await copyPlugin(pluginDir);
			await evaluate(c, enablePluginExpression());
		}, null);
		console.log(`Reloaded ${pluginId}`);
	},

	async logs(seconds = '5') {
		await withClient(async (c) => {
			c.Runtime.consoleAPICalled(({ type, args }) => {
				const text = args
					.map((a) => a.value ?? a.description ?? a.type)
					.join(' ');
				console.log(`[${type}] ${text}`);
			});
			c.Runtime.exceptionThrown(({ exceptionDetails }) => {
				console.log(
					`[exception] ${exceptionDetails.exception?.description ?? exceptionDetails.text}`,
				);
			});
			await c.Runtime.enable();
			await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
		});
	},
};

const run = commands[command];
if (!run) {
	console.error(
		`Unknown command "${command ?? ''}". Commands: ${Object.keys(commands).join(', ')}`,
	);
	process.exit(2);
}
// One deadline for the whole command (logs adds its watch time), so a hung
// CDP call or evaluation fails instead of blocking the caller.
const timeout = 60_000 + (command === 'logs' ? Number(rest[0] ?? 5) * 1000 : 0);
setTimeout(() => {
	console.error(`${command} timed out after ${timeout} ms`);
	process.exit(1);
}, timeout).unref();
try {
	await run(...rest);
	process.exit(0);
} catch (e) {
	console.error(e instanceof Error ? e.message : e);
	process.exit(1);
}
