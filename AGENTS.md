# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Environment & tooling

- Node.js: use current LTS (Node 22+ recommended).
- **Package manager: npm** (required for this sample - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

**Note**: This sample project has specific technical dependencies on npm and esbuild. If you're creating a plugin from scratch, you can choose different tools, but you'll need to replace the build configuration accordingly.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- ESLint is preconfigured with `eslint-plugin-obsidianmd` for Obsidian-specific rules.
- Run `npm run lint` to lint the project.
- A GitHub Action automatically lints every commit on all branches.

## File & folder conventions

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Example file structure**:
    ```
    src/
      main.ts           # Plugin entry point, lifecycle management
      settings.ts       # Settings interface and defaults
      commands/         # Command implementations
        command1.ts
        command2.ts
      ui/              # UI components, modals, views
        modal.ts
        view.ts
      utils/           # Utility functions, helpers
        helpers.ts
        constants.ts
      types.ts         # TypeScript interfaces and types
    ```
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):
    - `id` (plugin ID; for local dev it should match the folder name)
    - `name`
    - `version` (Semantic Versioning `x.y.z`)
    - `minAppVersion`
    - `description`
    - `isDesktopOnly` (boolean)
    - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

Verify every behavior change yourself with the layers below; never ask the user to check in Obsidian. None of them touch the user's own Obsidian install, config or vaults: Obsidian is downloaded into `.obsidian-cache/` and runs with a sandboxed config dir against a temporary copy of `test/vaults/simple/`.

| Layer                   | Command                                                 | What it covers                                                                                                                                  |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                    | `npm test`                                              | Pure logic with Vitest. `obsidian` is replaced by `test/mocks/obsidian.ts`; extend the mock as needed.                                          |
| Types                   | `npm run typecheck`                                     | `src/` plus tests and test configs.                                                                                                             |
| E2E desktop + mobile UI | `npm run test:e2e`                                      | Real Obsidian through WebdriverIO + `wdio-obsidian-service`, once with the desktop UI and once with Obsidian's mobile emulation (phone UI).     |
| E2E Android             | `npm run test:e2e:android`                              | The real Obsidian Android app in an emulator via Appium. Needs the Android SDK and an AVD named `obsidian_test` (or `ANDROID_AVD`). Runs in CI. |
| Interactive             | `npm run obsidian:launch` + `npm run obsidian:cdp -- …` | Drive a running Obsidian by hand to explore or debug.                                                                                           |

### E2E tests

- Specs live in `test/e2e/*.e2e.ts`. Use `browser.executeObsidian(({ app, obsidian, plugins }) => …)` to reach the app; `plugins.samplePlugin` is this plugin, typed in `test/e2e/types.d.ts`.
- Reset state with `resetVault()` from `test/e2e/helpers.ts`, **not** `obsidianPage.resetVault()`: the latter deletes `.obsidian` in wdio-obsidian-service 3.3.0.
- Desktop Obsidian 1.14+ opens settings in a popout window; see `openPluginSettings()` in the spec for switching windows.
- Environment variables:
    - `OBSIDIAN_VERSIONS` — `app/installer` pairs, e.g. `"latest/latest 1.0.3/earliest"` (default `latest/latest`). `earliest` = `minAppVersion`; 1.0.3 is the oldest version the tooling supports.
    - `E2E_TARGETS` — `desktop`, `mobile` or both (default `desktop,mobile`).
    - `E2E_MAX_INSTANCES` — parallel Obsidian instances (default 4).
- Run a subset: `npx wdio run test/wdio.conf.mts --spec test/e2e/plugin.e2e.ts --mochaOpts.grep "settings"` (build first with `npm run build`).
- Failing tests save a screenshot to `test-results/screenshots/`; read it to see what went wrong. Logs are in `test-results/logs/`.
- The Obsidian UI follows the OS language, so select elements by CSS class or attributes rather than visible UI text.

### Interactive debugging

1. `npm run obsidian:launch` (run in the background) builds the plugin and starts a sandboxed Obsidian with the Chrome DevTools Protocol on a free port (`OBSIDIAN_DEBUG_PORT` to fix one). Wait for `Obsidian ready`: it is printed after the plugin's `onload()` has finished; the process exits non-zero instead if that takes over 2 minutes. `OBSIDIAN_VERSION`, `OBSIDIAN_INSTALLER` and `OBSIDIAN_VAULT` pick the version and vault. Several sessions can run at once.
2. Drive it with `node scripts/obsidian-cdp.mjs [--session <pid>] <command>` (`--session` is needed only when several sessions run). It only uses windows of a session recorded in `.obsidian-cache/sessions/`: the window showing that session's temporary vault and popouts opened from it, never another Obsidian or another vault.
    - `eval "<expr>"` — evaluate JS (awaited, `app` is global) and print JSON.
    - `command <id>` — run a command, e.g. `sample-plugin:open-preview`.
    - `screenshot [file]` — save a PNG (default `test-results/screenshots/cdp-*.png`), then read it.
    - `reload` — after `npm run build`, copy the build into the vault and re-enable the plugin; returns after `onload()` finished and fails if it threw.
    - `logs [seconds]` — stream console output and exceptions.
    - Each command fails (non-zero exit) after 60 seconds, plus the watch time for `logs`.
    - `targets` / `--window <text>` — list the session's windows and pick one (e.g. the settings popout); the default is the vault window.
3. Stop the launch process when done (Ctrl+C or SIGTERM). It closes Obsidian, forcing it after 5 seconds, and deletes the temporary vault, config dir and session record; it does the same when Obsidian crashes or startup fails, and exits non-zero on any failure, including a cleanup that failed. Files the launcher creates before Obsidian starts, or anything left after the launch process itself is killed with SIGKILL, are not covered.

### Platform coverage

- CI (`.github/workflows/e2e.yml`): desktop on Linux, macOS and Windows for the latest version and 1.0.3, each with desktop and mobile-emulated UI; the Android app on an emulator.
- iOS is not covered automatically: Obsidian's iOS app is only distributed through the App Store and cannot be installed in the iOS Simulator. Mobile emulation and Android cover the shared mobile code paths (`Platform.isMobile`, no Node/Electron APIs), but not iOS-only branches (`Platform.isIosApp`) or WebKit rendering. Mobile emulation still runs in Electron, so only Android proves the absence of Node/Electron APIs. Checking on a physical iOS device (Safari Web Inspector) requires the user.

### Manual install

- Copy `main.js`, `manifest.json`, `styles.css` (if any) to:
    ```
    <Vault>/.obsidian/plugins/<plugin-id>/
    ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**

- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**

- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):

```ts
import { Plugin } from 'obsidian';
import { MySettings, DEFAULT_SETTINGS } from './settings';
import { registerCommands } from './commands';

export default class MyPlugin extends Plugin {
	settings!: MySettings;

	async onload() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MySettings>,
		);
		registerCommands(this);
	}
}
```

**settings.ts**:

```ts
export interface MySettings {
	enabled: boolean;
	apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
	enabled: true,
	apiKey: '',
};
```

**commands/index.ts**:

```ts
import { Plugin } from 'obsidian';
import { doSomething } from './my-command';

export function registerCommands(plugin: Plugin) {
	plugin.addCommand({
		id: 'do-something',
		name: 'Do something',
		callback: () => doSomething(plugin),
	});
}
```

### Add a command

```ts
this.addCommand({
	id: 'your-command-id',
	name: 'Do the thing',
	callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MySettings>);
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(
	this.app.workspace.on('file-open', (f) => {
		/* ... */
	}),
);
this.registerDomEvent(activeWindow, 'resize', () => {
	/* ... */
});
this.registerInterval(
	window.setInterval(() => {
		/* ... */
	}, 1000),
);
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
