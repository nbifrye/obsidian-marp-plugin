import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
export const cacheDir = path.join(repoRoot, '.obsidian-cache');
export const resultsDir = path.join(repoRoot, 'test-results');

/**
 * Obsidian versions to test, as `app/installer` pairs separated by spaces or
 * commas. Each side accepts a version number, `latest`, `earliest` (the
 * plugin's minAppVersion) or `latest-beta`.
 * e.g. OBSIDIAN_VERSIONS="earliest/earliest latest/latest"
 */
export function obsidianVersions(
	fallback = 'latest/latest',
): [app: string, installer: string][] {
	const raw = process.env.OBSIDIAN_VERSIONS?.trim() || fallback;
	return raw.split(/[\s,]+/).map((pair) => {
		const [app = 'latest', installer = 'latest'] = pair.split('/');
		return [app, installer];
	});
}

export const baseConfig: WebdriverIO.Config = {
	runner: 'local',
	framework: 'mocha',
	specs: ['./e2e/**/*.e2e.ts'],
	capabilities: [],
	services: ['obsidian'],
	reporters: ['obsidian'],
	cacheDir,
	mochaOpts: {
		ui: 'bdd',
		timeout: 120_000,
	},
	logLevel: 'warn',
	outputDir: path.join(resultsDir, 'logs'),
	waitforTimeout: 10_000,

	// Keep a screenshot of every failing test so the failure can be inspected
	// without rerunning (see test-results/screenshots/).
	afterTest: async function (test, _context, { passed, error }) {
		// Skipped tests report passed: false without an error.
		if (passed || !error) return;
		const dir = path.join(resultsDir, 'screenshots');
		await fs.mkdir(dir, { recursive: true });
		// Tag the file with the target so parallel capabilities running the same
		// test (desktop vs mobile, several versions) don't overwrite each other.
		const caps = browser.requestedCapabilities as WebdriverIO.Capabilities;
		const target =
			caps.platformName === 'Android'
				? 'android'
				: caps['wdio:obsidianOptions']?.emulateMobile
					? 'mobile'
					: 'desktop';
		const name = [
			test.parent,
			test.title,
			target,
			// browserVersion is replaced by the Chromium version at runtime.
			caps['wdio:obsidianOptions']?.appVersion ?? 'latest',
			Date.now(),
		]
			.join(' ')
			.replace(/[^\w.-]+/g, '_');
		await browser.saveScreenshot(path.join(dir, `${name}.png`));
	},
};
