import ObsidianLauncher from 'obsidian-launcher';
import { baseConfig, cacheDir, obsidianVersions } from './wdio.base.mts';

// The real Obsidian Android app inside an Android Virtual Device, driven
// through Appium. Requires the Android SDK and an AVD named by ANDROID_AVD
// (default: obsidian_test).
const avd = process.env.ANDROID_AVD ?? 'obsidian_test';

// Some releases are desktop only (1.14.5 has no APK), so `latest` is the
// newest release that has one.
async function androidVersion(version: string): Promise<string> {
	if (version !== 'latest') return version;
	const versions = await new ObsidianLauncher({ cacheDir }).getVersions();
	const withApk = versions.filter((v) => !v.isBeta && v.downloads.apk);
	const latest = withApk[withApk.length - 1];
	if (!latest) throw new Error('No Obsidian release has an APK');
	return latest.version;
}

const appVersions = await Promise.all(
	obsidianVersions().map(([appVersion]) => androidVersion(appVersion)),
);

export const config: WebdriverIO.Config = {
	...baseConfig,
	// A single emulator cannot run sessions in parallel.
	maxInstances: 1,
	capabilities: appVersions.map((appVersion) => ({
		browserName: 'obsidian',
		browserVersion: appVersion,
		platformName: 'Android',
		'appium:automationName': 'UiAutomator2',
		'appium:avd': avd,
		// The service resets Obsidian itself when needed.
		'appium:noReset': true,
		'appium:adbExecTimeout': 60_000,
		'wdio:obsidianOptions': {
			plugins: ['..'],
			vault: './vaults/simple',
		},
	})),
	services: [
		...(baseConfig.services ?? []),
		[
			'appium',
			{
				args: {
					allowInsecure: '*:chromedriver_autodownload,*:adb_shell',
				},
			},
		],
	],
	mochaOpts: {
		...baseConfig.mochaOpts,
		timeout: 300_000,
	},
};
