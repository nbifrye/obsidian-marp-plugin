import { baseConfig, obsidianVersions } from './wdio.base.mts';

// Desktop Obsidian (Electron) on the host OS. Each version runs once per
// target in E2E_TARGETS (comma separated, default "desktop,mobile"):
//   desktop  the regular desktop UI
//   mobile   the phone UI through Obsidian's mobile emulation
const targets = new Set(
	(process.env.E2E_TARGETS ?? 'desktop,mobile').split(/[\s,]+/),
);

const capabilities: WebdriverIO.Capabilities[] = obsidianVersions().flatMap(
	([appVersion, installerVersion]) => {
		const desktop: WebdriverIO.Capabilities = {
			browserName: 'obsidian',
			browserVersion: appVersion,
			'wdio:obsidianOptions': {
				installerVersion,
				plugins: ['..'],
				vault: './vaults/simple',
			},
		};
		const mobile: WebdriverIO.Capabilities = {
			...desktop,
			'wdio:obsidianOptions': {
				...desktop['wdio:obsidianOptions'],
				emulateMobile: true,
			},
			'goog:chromeOptions': {
				mobileEmulation: {
					deviceMetrics: { width: 390, height: 844 },
				},
			},
		};
		return [
			...(targets.has('desktop') ? [desktop] : []),
			...(targets.has('mobile') ? [mobile] : []),
		];
	},
);

export const config: WebdriverIO.Config = {
	...baseConfig,
	maxInstances: Number(process.env.E2E_MAX_INSTANCES ?? 4),
	capabilities,
};
