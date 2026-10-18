import { baseConfig, obsidianVersions } from './wdio.base.mts';

// The real Obsidian Android app inside an Android Virtual Device, driven
// through Appium. Requires the Android SDK and an AVD named by ANDROID_AVD
// (default: obsidian_test).
const avd = process.env.ANDROID_AVD ?? 'obsidian_test';

export const config: WebdriverIO.Config = {
	...baseConfig,
	// A single emulator cannot run sessions in parallel.
	maxInstances: 1,
	capabilities: obsidianVersions().map(([appVersion]) => ({
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
