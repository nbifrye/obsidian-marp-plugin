import { browser, expect } from '@wdio/globals';
import { obsidianPage } from 'wdio-obsidian-service';
import type { MarpPluginSettings } from '../../src/settings';
import { resetVault } from './helpers';

const PLUGIN_ID = 'marp-deck';
const VIEW_TYPE = 'marp-core-slides-preview';

type PluginManager = {
	plugins: Record<string, unknown>;
	enabledPlugins: Set<string>;
	disablePlugin(id: string): Promise<void>;
	enablePlugin(id: string): Promise<void>;
};

type SettingModal = {
	open(): void;
	close(): void;
	openTabById(id: string): void;
};

/**
 * Opens this plugin's settings tab and focuses the window that shows it.
 * Desktop Obsidian 1.14+ opens settings in a popout window, while mobile
 * (and older desktop versions) show it as a modal in the main window.
 */
async function openPluginSettings(): Promise<void> {
	const before = await browser.getWindowHandles();
	await browser.executeObsidian(({ app }, id) => {
		const setting = (app as unknown as { setting: SettingModal }).setting;
		setting.open();
		setting.openTabById(id);
	}, PLUGIN_ID);

	let popout: string | undefined;
	await browser.waitUntil(async () => {
		const handles = await browser.getWindowHandles();
		popout = handles.find((h) => !before.includes(h));
		return (
			popout !== undefined ||
			browser.$('.vertical-tab-content').isExisting()
		);
	});
	if (popout) await browser.switchToWindow(popout);
}

/** Closes every tab in the main area. */
async function closeAllTabs(): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		// Collect first: detaching while iterating skips leaves on Obsidian 1.0.
		const leaves: { detach(): void }[] = [];
		app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() !== 'empty') leaves.push(leaf);
		});
		for (const leaf of leaves) leaf.detach();
	});
}

/** Opens a note in the active tab. */
async function openNote(path: string): Promise<void> {
	await obsidianPage.openFile(path);
}

/** Opens the slide preview for the active note. */
async function openPreview(): Promise<void> {
	await browser.executeObsidianCommand(`${PLUGIN_ID}:open-preview`);
}

interface PreviewInfo {
	file: string | null;
	message: string;
	slides: number;
	text: string;
}

/** State of the preview after its pending render finished. */
async function previewInfo(): Promise<PreviewInfo> {
	return browser.executeObsidian(async ({ app }, type) => {
		const view = app.workspace.getLeavesOfType(type)[0]?.view as unknown as
			| {
					file: { path: string } | null;
					rendered: Promise<void>;
					messageEl: HTMLElement;
					frame: { slides(): unknown[]; document: Document | null };
			  }
			| undefined;
		if (!view) throw new Error('No preview');
		// Wait out the debounce, then the render it started.
		await new Promise((r) => window.setTimeout(r, 400));
		await view.rendered;
		return {
			file: view.file?.path ?? null,
			// Not isShown(): on mobile the preview may be a background tab.
			message:
				view.messageEl.style.display === 'none'
					? ''
					: (view.messageEl.textContent ?? ''),
			slides: view.frame.slides().length,
			text: view.frame.document?.body.textContent ?? '',
		};
	}, VIEW_TYPE);
}

/**
 * Runs a snippet (an async function body) with the preview frame's document
 * as `doc` and its element as `iframe`, and returns its result.
 */
async function inFrame<T>(body: string): Promise<T> {
	return browser.execute(`
		const view = app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})[0].view;
		return (async (doc, iframe) => { ${body} })(view.frame.document, view.frame.iframe);
	`) as Promise<T>;
}

/**
 * Runs the plugin's ribbon action, or just counts them when `run` is false.
 * The ribbon has a (possibly hidden) button per action, except in the phone
 * UI of older versions, which only list them in a menu built from
 * `leftRibbon.orderedRibbonActions`.
 */
async function ribbonAction(title: string, run: boolean): Promise<number> {
	return browser.executeObsidian(
		({ app }, title, run) => {
			const buttons = [
				...document.querySelectorAll<HTMLElement>(
					'.side-dock-ribbon-action',
				),
			]
				.filter((el) => el.getAttribute('aria-label') === title)
				.map((el) => () => el.click());
			const { leftRibbon } = app.workspace as unknown as {
				leftRibbon: {
					orderedRibbonActions?: {
						title: string;
						callback: () => void;
					}[];
				};
			};
			const actions = buttons.length
				? buttons
				: (leftRibbon.orderedRibbonActions ?? [])
						.filter((a) => a.title === title)
						.map((a) => () => a.callback());
			if (run) actions[0]?.();
			return actions.length;
		},
		title,
		run,
	);
}

/**
 * Titles of the items a menu event adds, and clicks the one named `click`.
 * Uses a stand-in menu so the check does not depend on Obsidian's menu DOM.
 */
async function menuItems(
	target: 'file' | 'preview',
	path: string,
	click?: string,
): Promise<string[]> {
	return browser.executeObsidian(
		({ app }, target, path, click, type) => {
			const titles: string[] = [];
			const actions = new Map<string, () => void>();
			const menu = {
				addSeparator: () => menu,
				addItem(cb: (item: unknown) => void) {
					let title = '';
					const item = {
						setTitle: (t: string) => ((title = t), item),
						setIcon: () => item,
						setSection: () => item,
						setChecked: () => item,
						setDisabled: () => item,
						setWarning: () => item,
						onClick: (f: () => void) => (
							actions.set(title, f),
							item
						),
					};
					cb(item);
					titles.push(title);
					return menu;
				},
			};
			if (target === 'file') {
				const file = app.vault.getAbstractFileByPath(path);
				app.workspace.trigger('file-menu', menu, file, 'more-options');
			} else {
				const view = app.workspace.getLeavesOfType(type)[0]!
					.view as unknown as {
					onPaneMenu(menu: unknown, source: string): void;
				};
				view.onPaneMenu(menu, 'more-options');
			}
			if (click) actions.get(click)?.();
			return titles;
		},
		target,
		path,
		click,
		VIEW_TYPE,
	);
}

async function setSettings(values: Partial<MarpPluginSettings>): Promise<void> {
	await browser.executeObsidian(async ({ plugins }, values) => {
		Object.assign(plugins.marpDeck.settings, values);
		await plugins.marpDeck.saveSettings();
	}, values);
}

async function writeNote(path: string, content: string): Promise<void> {
	await obsidianPage.write(path, content);
}

const deck = (body: string, front = '') =>
	`---\nmarp: true\n${front}---\n\n${body}\n`;

const longDeck = (slides: number) =>
	deck(
		Array.from({ length: slides }, (_, i) => `# Slide ${i + 1}`).join(
			'\n\n---\n\n',
		),
	);

/** Scrolls the preview so the slide is at the top. */
async function scrollToSlide(index: number): Promise<void> {
	await inFrame(`
		const slide = doc.querySelectorAll('div.marpit > svg')[${index}];
		const scroller = doc.scrollingElement;
		scroller.scrollTop = slide.getBoundingClientRect().top + scroller.scrollTop - 16;
	`);
}

/** The slide the preview keeps in view across re-renders. */
async function currentSlide(): Promise<number> {
	return browser.executeObsidian(({ app }, type) => {
		const view = app.workspace.getLeavesOfType(type)[0]
			?.view as unknown as {
			currentSlide: number;
			positionKnown: boolean;
			frame: { visibleSlide(): number };
		};
		return view.positionKnown
			? view.frame.visibleSlide()
			: view.currentSlide;
	}, VIEW_TYPE);
}

describe('Marp plugin', function () {
	// Settings as loaded from a vault without data.json, i.e. the defaults.
	let defaults: MarpPluginSettings;

	before(async function () {
		defaults = await browser.executeObsidian(({ plugins }) =>
			structuredClone(plugins.marpDeck.settings),
		);
	});

	beforeEach(async function () {
		await resetVault();
		await setSettings(defaults);
		await openNote('Slides.md');
	});

	afterEach(async function () {
		await browser.switchToWindow(await obsidianPage.getMainWindowHandle());
		const settingsOpen =
			(await browser.getWindowHandles()).length > 1 ||
			(await browser.$('.modal.mod-settings').isExisting());
		// Only close settings when shown: calling close() on a closed settings
		// modal breaks the next open() on Obsidian 1.0 mobile.
		if (settingsOpen) {
			await browser.executeObsidian(({ app }) => {
				(app as unknown as { setting: SettingModal }).setting.close();
			});
		}
		for (let i = 0; i < 5; i++) {
			if (!(await browser.$('.modal-container').isExisting())) break;
			await browser.keys('Escape');
		}
		await closeAllTabs();
	});

	it('is loaded and enabled', async function () {
		const enabled = await browser.executeObsidian(
			({ app }, id) =>
				(
					app as unknown as { plugins: PluginManager }
				).plugins.enabledPlugins.has(id),
			PLUGIN_ID,
		);
		expect(enabled).toBe(true);
	});

	it('renders math, code, Mermaid and images in the preview', async function () {
		await openPreview();
		const info = await previewInfo();
		expect(info).toMatchObject({
			file: 'Slides.md',
			message: '',
			slides: 4,
		});

		const content = await inFrame<Record<string, unknown>>(`
			await Promise.all([...doc.images].map((i) => i.decode().catch(() => {})));
			return {
				mathjax: doc.querySelectorAll('mjx-container').length,
				shiki: doc.querySelectorAll('pre.shiki, marp-pre.shiki, [class*="shiki"]').length > 0,
				mermaid: doc.querySelectorAll('svg[data-marp-mermaid]').length,
				images: [...doc.images].map((i) => i.naturalWidth),
				customElements: !!doc.querySelector('marp-pre')?.shadowRoot,
				emoji: doc.body.textContent.includes('🚀'),
			};
		`);
		expect(content).toEqual({
			mathjax: 2,
			shiki: true,
			mermaid: 1,
			images: [40, 40, 40],
			customElements: true,
			emoji: true,
		});
	});

	it('typesets with KaTeX and its bundled fonts when selected', async function () {
		await setSettings({ math: 'katex' });
		await openPreview();
		await previewInfo();
		const fonts = await inFrame<string[]>(`
			await doc.fonts.ready;
			return [...doc.fonts]
				.filter((f) => f.family.startsWith('KaTeX') && f.status === 'loaded')
				.map((f) => f.family);
		`);
		expect(fonts).toContain('KaTeX_Main');
		expect(fonts).toContain('KaTeX_Math');
	});

	it('follows unsaved edits and keeps the current slide', async function () {
		await writeNote('Slides.md', longDeck(10));
		await openPreview();
		await previewInfo();
		await scrollToSlide(5);

		await browser.executeObsidian(({ app, obsidian }) => {
			const view = app.workspace
				.getLeavesOfType('markdown')
				.map((l) => l.view)
				.find(
					(v) =>
						v instanceof obsidian.MarkdownView &&
						v.file?.path === 'Slides.md',
				);
			if (!(view instanceof obsidian.MarkdownView))
				throw new Error('No editor');
			view.editor.replaceRange('\nUnsaved edit\n', { line: 4, ch: 0 });
		});
		const info = await previewInfo();
		expect(info.text).toContain('Unsaved edit');
		expect(await currentSlide()).toBe(5);
	});

	it('clamps the current slide when slides are removed', async function () {
		await writeNote('Slides.md', longDeck(10));
		await openPreview();
		await previewInfo();
		// The last slides may not reach the top, so check only that it is past
		// the slides that will remain.
		await scrollToSlide(9);
		expect(await currentSlide()).toBeGreaterThan(2);

		await writeNote('Slides.md', longDeck(3));
		const info = await previewInfo();
		expect(info.slides).toBe(3);
		const state = await browser.executeObsidian(({ app }, type) => {
			const view = app.workspace.getLeavesOfType(type)[0]
				?.view as unknown as {
				currentSlide: number;
				frame: { document: Document };
			};
			const scroller = view.frame.document.scrollingElement!;
			return {
				kept: view.currentSlide,
				// As far towards the last slide as the content allows.
				scrolled:
					scroller.scrollTop >=
					Math.min(
						scroller.scrollHeight - scroller.clientHeight,
						view.frame.document
							.querySelectorAll('div.marpit > svg')[2]!
							.getBoundingClientRect().top +
							scroller.scrollTop -
							16,
					) -
						1,
			};
		}, VIEW_TYPE);
		expect(state).toEqual({ kept: 2, scrolled: true });
	});

	it('follows the active note and explains non-Marp notes', async function () {
		await openPreview();
		await previewInfo();
		await openNote('Welcome.md');
		const info = await previewInfo();
		expect(info.file).toBe('Welcome.md');
		expect(info.message).toContain('marp: true');
	});

	it('presents one slide at a time and navigates', async function () {
		await browser.executeObsidianCommand(`${PLUGIN_ID}:start-presentation`);
		const counter = browser.$('.marp-core-slides-counter');
		await expect(counter).toHaveText('1 / 4');

		await browser.keys('ArrowRight');
		await expect(counter).toHaveText('2 / 4');
		await browser.keys('End');
		await expect(counter).toHaveText('4 / 4');
		await browser.keys('ArrowRight');
		await expect(counter).toHaveText('4 / 4');
		await browser
			.$('.marp-core-slides-toolbar button[aria-label="Previous slide"]')
			.click();
		await expect(counter).toHaveText('3 / 4');

		const visible = await browser.executeObsidian(() => {
			const doc = document.querySelector<HTMLIFrameElement>(
				'.marp-core-slides-presentation iframe',
			)?.contentDocument;
			return [...(doc?.querySelectorAll('div.marpit > svg') ?? [])].map(
				(s) => getComputedStyle(s).display,
			);
		});
		expect(visible).toEqual(['none', 'none', 'block', 'none']);

		await browser
			.$(
				'.marp-core-slides-toolbar button[aria-label="End presentation"]',
			)
			.click();
		await expect(browser.$('.marp-core-slides-presentation')).not.toExist();
	});

	it('opens the preview from the ribbon', async function () {
		expect(await ribbonAction('Open slide preview', true)).toBe(1);
		expect((await previewInfo()).file).toBe('Slides.md');
	});

	it('offers the slide actions in the file menu of Marp notes', async function () {
		const desktop = await browser.executeObsidian(
			({ obsidian }) => obsidian.Platform.isDesktopApp,
		);
		const items = await menuItems('file', 'Slides.md');
		expect(items).toEqual(
			expect.arrayContaining([
				'Open slide preview',
				'Start presentation',
				'Export as HTML',
			]),
		);
		expect(items.includes('Print slides')).toBe(desktop);
		expect(await menuItems('file', 'Welcome.md')).not.toContain(
			'Start presentation',
		);

		await menuItems('file', 'Slides.md', 'Start presentation');
		await expect(browser.$('.marp-core-slides-counter')).toHaveText(
			'1 / 4',
		);
		await browser.keys('Escape');
		await expect(browser.$('.marp-core-slides-presentation')).not.toExist();

		await menuItems('file', 'Slides.md', 'Open slide preview');
		expect((await previewInfo()).file).toBe('Slides.md');
	});

	it('offers the slide actions in the preview header and menu', async function () {
		await writeNote('Slides.md', longDeck(10));
		await openPreview();
		await previewInfo();
		const items = await menuItems('preview', '');
		expect(items).toEqual(
			expect.arrayContaining(['Start presentation', 'Export as HTML']),
		);
		expect(items).not.toContain('Open slide preview');

		await scrollToSlide(4);
		await browser.waitUntil(async () => (await currentSlide()) === 4);
		await menuItems('preview', '', 'Start presentation');
		await expect(browser.$('.marp-core-slides-counter')).toHaveText(
			'5 / 10',
		);
		await browser.keys('Escape');
		await expect(browser.$('.marp-core-slides-presentation')).not.toExist();

		await browser
			.$(
				`.workspace-leaf-content[data-type="${VIEW_TYPE}"] .view-action[aria-label="Start presentation"]`,
			)
			.click();
		await expect(browser.$('.marp-core-slides-counter')).toHaveText(
			'5 / 10',
		);
	});

	it('exports a self-contained HTML file', async function () {
		await browser.executeObsidianCommand(`${PLUGIN_ID}:export-html`);
		const html = (await browser.waitUntil(() =>
			browser.executeObsidian(async ({ app }) => {
				const file = app.vault.getAbstractFileByPath('Slides.html');
				return file ? app.vault.read(file as never) : false;
			}),
		)) as string;
		expect(html).toContain('Content-Security-Policy');
		expect(html.match(/data:image\/png;base64/g)).toHaveLength(3);
		expect(html).not.toMatch(/app:\/\/|capacitor:\/\/|_capacitor_file_/);
		expect(html.match(/<script/g)).toHaveLength(1);

		// The exported page runs only its own hashed script.
		const shown = await browser.executeObsidian(async (_, html) => {
			const frame = document.body.createEl('iframe');
			frame.srcdoc = html;
			await new Promise((r) =>
				frame.addEventListener('load', r, { once: true }),
			);
			const doc = frame.contentDocument!;
			const active = () =>
				[...doc.querySelectorAll('div.marpit > svg')].findIndex((s) =>
					s.classList.contains('marp-active'),
				);
			const first = active();
			frame.contentWindow!.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'End' }),
			);
			const last = active();
			frame.remove();
			return { first, last };
		}, html);
		expect(shown).toEqual({ first: 0, last: 3 });
	});

	it('never runs scripts or navigates, even with all HTML allowed', async function () {
		await setSettings({ html: 'all' });
		await writeNote(
			'Slides.md',
			deck(
				[
					'<script>document.title = "pwned"</script>',
					'<img src="x" onerror="document.title = \'pwned\'">',
					'<a id="js" href="javascript:document.title=\'pwned\'">js</a>',
					'<meta http-equiv="refresh" content="0;url=https://example.com">',
					'<iframe src="https://example.com"></iframe>',
					'<svg width="100" height="20"><a id="svg" xlink:href="https://example.com/svg"><text y="15">svg</text></a></svg>',
					'<b id="kept">kept</b>',
				].join('\n\n'),
			),
		);
		await openPreview();
		await previewInfo();
		const result = await inFrame<Record<string, unknown>>(`
			const opened = [];
			const open = window.open;
			window.open = (url) => { opened.push(url); return null; };
			doc.getElementById('js')?.click();
			doc.querySelector('#svg text').dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
			window.open = open;
			await new Promise((r) => setTimeout(r, 300));
			return {
				title: doc.title,
				kept: !!doc.getElementById('kept'),
				scripts: doc.querySelectorAll('#marp-root script, #marp-root iframe, #marp-root meta').length,
				handlers: doc.querySelectorAll('#marp-root [onerror]').length,
				jsHref: doc.getElementById('js')?.getAttribute('href') ?? null,
				url: iframe.contentWindow.location.href,
				opened,
			};
		`);
		expect(result).toEqual({
			title: '',
			kept: true,
			scripts: 0,
			handlers: 0,
			jsHref: null,
			url: 'about:srcdoc',
			// SVG links are handled by the app like HTML links.
			opened: ['https://example.com/svg'],
		});
		expect(await browser.getTitle()).not.toBe('pwned');
	});

	it('blocks external resources when asked to', async function () {
		await setSettings({ blockExternalResources: true });
		await openPreview();
		await previewInfo();
		// Close the editor so Obsidian itself does not load the image, then
		// render the external references through the preview only.
		await browser.executeObsidian(({ app }) => {
			for (const leaf of app.workspace.getLeavesOfType('markdown'))
				leaf.detach();
		});
		await inFrame(`
			window.__violations = [];
			doc.addEventListener('securitypolicyviolation', (e) =>
				window.__violations.push(e.blockedURI));
		`);
		await writeNote(
			'Slides.md',
			deck(
				'![](https://example.com/blocked.png)\n\n<img src="https://example.com/raw.png">\n\n<style>@import url("https://example.com/a.css");</style>',
			),
		);
		await previewInfo();
		const result = await inFrame<{
			violations: string[];
			parentLoads: string[];
			widths: number[];
		}>(`
			await new Promise((r) => setTimeout(r, 500));
			return {
				violations: [...new Set(window.__violations)].sort(),
				// Parsing happens in an inert template, so the app never fetches them.
				parentLoads: performance.getEntriesByType('resource')
					.map((e) => e.name).filter((n) => n.includes('example.com')),
				widths: [...doc.images].map((i) => i.naturalWidth),
			};
		`);
		expect(result).toEqual({
			violations: [
				'https://example.com/a.css',
				'https://example.com/blocked.png',
				'https://example.com/raw.png',
			],
			parentLoads: [],
			widths: [0, 0],
		});
	});

	it('uses custom themes from the theme folder and drops deleted ones', async function () {
		await writeNote(
			'Themes/mine.css',
			'/* @theme mine */\n@import "default";\nsection { background: rgb(1, 2, 3); }',
		);
		await setSettings({ themeFolder: 'Themes' });
		await writeNote('Slides.md', deck('# Themed', 'theme: mine\n'));
		await openPreview();
		await previewInfo();
		const background = () =>
			inFrame<string>(
				`return getComputedStyle(doc.querySelector('section')).backgroundColor;`,
			);
		expect(await background()).toBe('rgb(1, 2, 3)');

		await obsidianPage.delete('Themes/mine.css');
		await browser.waitUntil(
			async () => (
				await previewInfo(),
				(await background()) !== 'rgb(1, 2, 3)'
			),
		);
	});

	it('keeps Marp styles out of the Obsidian UI', async function () {
		await openPreview();
		await previewInfo();
		const leaked = await browser.executeObsidian(() =>
			[...document.querySelectorAll('style')].some((s) =>
				(s.textContent ?? '').includes('div.marpit'),
			),
		);
		expect(leaked).toBe(false);
	});

	it('persists changes made in the settings tab', async function () {
		await openPluginSettings();
		const select = browser.$('.vertical-tab-content select');
		await expect(select).toHaveValue('mathjax');
		await select.selectByAttribute('value', 'katex');

		await browser.waitUntil(async () => {
			const saved = await browser.executeObsidian(
				async ({ plugins }) =>
					(await plugins.marpDeck.loadData()) as Partial<MarpPluginSettings> | null,
			);
			return saved?.math === 'katex';
		});
	});

	it('removes its views and commands on unload and restores them on load', async function () {
		await openPreview();
		await previewInfo();
		const state = await browser.executeObsidian(
			async ({ app }, id, type) => {
				const manager = (app as unknown as { plugins: PluginManager })
					.plugins;
				const commands = () =>
					Object.keys(
						(
							app as unknown as {
								commands: { commands: Record<string, unknown> };
							}
						).commands.commands,
					).filter((c) => c.startsWith(`${id}:`)).length;
				const frames = () =>
					document.querySelectorAll('iframe.marp-core-slides-frame')
						.length;
				await manager.disablePlugin(id);
				const disabled = { commands: commands(), frames: frames() };
				await manager.enablePlugin(id);
				return {
					disabled,
					enabled: { commands: commands() },
					views: app.workspace.getLeavesOfType(type).length,
				};
			},
			PLUGIN_ID,
			VIEW_TYPE,
		);

		expect(state.disabled).toEqual({ commands: 0, frames: 0 });
		expect(state.enabled).toEqual({ commands: 4 });
		expect(await ribbonAction('Open slide preview', false)).toBe(1);
	});
});
