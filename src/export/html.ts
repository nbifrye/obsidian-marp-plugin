import { App, TFile } from 'obsidian';
import browserScript from '@marp-team/marp-core/lib/browser-iife.iife.js?raw';
import type { MarpPluginSettings } from '../settings';
import { buildCsp, sha256Base64 } from '../render/csp';
import { findVaultFile, readAsDataUrl } from '../render/resources';
import {
	mediaUrls,
	parseHtml,
	resolveMediaUrls,
	sanitizeFragment,
} from '../render/sanitize';
import { cssUrls, readThemeSources, rewriteCssUrls } from '../render/themes';

export interface ExportResult {
	html: string;
	/** Vault URLs that could not be found, so they are missing from the file. */
	missing: string[];
}

// Shows one slide at a time; arrow keys, clicks and #<n> move between slides.
const navigationScript = `(()=>{const s=[...document.querySelectorAll('div.marpit > svg')];if(!s.length)return;let i=0;const go=n=>{i=Math.max(0,Math.min(s.length-1,n));s.forEach((e,k)=>e.classList.toggle('marp-active',k===i));try{history.replaceState(null,'','#'+(i+1))}catch(e){}};const fromHash=()=>{const n=parseInt(location.hash.slice(1),10);go(Number.isInteger(n)?n-1:0)};addEventListener('hashchange',fromHash);addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key;if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(k))go(i+1);else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(k))go(i-1);else if(k==='Home')go(0);else if(k==='End')go(s.length-1);else return;e.preventDefault()});addEventListener('click',e=>{if(e.target.closest&&e.target.closest('a[href]'))return;go(e.clientX<innerWidth/2?i-1:i+1)});fromHash()})();`;

const exportCss = `
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
div.marpit { height: 100%; }
div.marpit > svg { display: none; width: 100%; height: 100%; }
div.marpit > svg.marp-active { display: block; }
@media print {
	html, body { height: auto; overflow: visible; background: none; }
	div.marpit > svg { display: block; }
}
`;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Keeps CSS from closing the <style> element it is embedded in. */
function escapeStyle(css: string): string {
	return css.replace(/<\/(style)/gi, '<\\/$1');
}

/**
 * Renders a note to a self-contained HTML presentation. Vault images, theme
 * assets and KaTeX fonts are embedded as data URLs; external URLs are kept.
 */
export async function buildStandaloneHtml(
	app: App,
	settings: MarpPluginSettings,
	file: TFile,
	source: string,
): Promise<ExportResult> {
	const { createEngine } = await import('../render/engine');
	const themes = await readThemeSources(app, settings.themeFolder);
	const files = new Map<string, TFile>();
	const missing = new Set<string>();
	const collect = (url: string, from: string, kind?: 'link' | 'embed') => {
		const found = findVaultFile(app, url, from, kind);
		if (found) files.set(found.path, found);
		else missing.add(url);
		return undefined;
	};

	// First pass: find every vault file the slides and themes refer to.
	for (const theme of themes) {
		for (const url of cssUrls(theme.css)) collect(url, theme.path);
	}
	const draft = createEngine({ ...settings, themes }).render(source, {
		resolveUrl: (url, kind) => collect(url, file.path, kind),
	});
	for (const url of mediaUrls(parseHtml(draft.html))) {
		collect(url, file.path);
	}

	const data = new Map<string, string>();
	await Promise.all(
		[...files.values()].map(async (f) => {
			data.set(f.path, await readAsDataUrl(app, f));
		}),
	);
	const embed = (url: string, from: string, kind?: 'link' | 'embed') => {
		const found = findVaultFile(app, url, from, kind);
		return found ? data.get(found.path) : undefined;
	};

	// Second pass: render with everything embedded.
	const engine = createEngine({
		...settings,
		themes: themes.map((theme) => ({
			path: theme.path,
			css: rewriteCssUrls(theme.css, (url) => embed(url, theme.path)),
		})),
	});
	const result = engine.render(source, {
		resolveUrl: (url, kind) => embed(url, file.path, kind),
	});
	const container = parseHtml(result.html);
	sanitizeFragment(container);
	resolveMediaUrls(container, (url) => embed(url, file.path));

	const script = `${browserScript.replace(/\/\/# sourceMappingURL=\S*\s*$/, '')}\n${navigationScript}`;
	const csp = buildCsp({
		blockExternalResources: settings.blockExternalResources,
		resourceOrigin: '',
		scriptHashes: [await sha256Base64(script)],
	});

	const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>${escapeHtml(file.basename)}</title>
<style>${escapeStyle(result.css)}</style>
<style>${exportCss}</style>
</head>
<body>
${container.innerHTML}
<script>${script}</script>
</body>
</html>
`;
	return { html, missing: [...missing] };
}
