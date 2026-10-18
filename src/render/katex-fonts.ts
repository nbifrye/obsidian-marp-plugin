// KaTeX fonts bundled as data URLs, so math renders offline and without CDN
// requests (Marp Core loads them from jsDelivr by default).
// Generated list: one import per WOFF2 file in katex/dist/fonts.
import AMSRegular from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline';
import CaligraphicBold from 'katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline';
import CaligraphicRegular from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline';
import FrakturBold from 'katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline';
import FrakturRegular from 'katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline';
import MainBold from 'katex/dist/fonts/KaTeX_Main-Bold.woff2?inline';
import MainBoldItalic from 'katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline';
import MainItalic from 'katex/dist/fonts/KaTeX_Main-Italic.woff2?inline';
import MainRegular from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?inline';
import MathBoldItalic from 'katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline';
import MathItalic from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?inline';
import SansSerifBold from 'katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline';
import SansSerifItalic from 'katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline';
import SansSerifRegular from 'katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline';
import ScriptRegular from 'katex/dist/fonts/KaTeX_Script-Regular.woff2?inline';
import Size1Regular from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline';
import Size2Regular from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline';
import Size3Regular from 'katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline';
import Size4Regular from 'katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline';
import TypewriterRegular from 'katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline';

const fonts: Record<string, string> = {
	'KaTeX_AMS-Regular': AMSRegular,
	'KaTeX_Caligraphic-Bold': CaligraphicBold,
	'KaTeX_Caligraphic-Regular': CaligraphicRegular,
	'KaTeX_Fraktur-Bold': FrakturBold,
	'KaTeX_Fraktur-Regular': FrakturRegular,
	'KaTeX_Main-Bold': MainBold,
	'KaTeX_Main-BoldItalic': MainBoldItalic,
	'KaTeX_Main-Italic': MainItalic,
	'KaTeX_Main-Regular': MainRegular,
	'KaTeX_Math-BoldItalic': MathBoldItalic,
	'KaTeX_Math-Italic': MathItalic,
	'KaTeX_SansSerif-Bold': SansSerifBold,
	'KaTeX_SansSerif-Italic': SansSerifItalic,
	'KaTeX_SansSerif-Regular': SansSerifRegular,
	'KaTeX_Script-Regular': ScriptRegular,
	'KaTeX_Size1-Regular': Size1Regular,
	'KaTeX_Size2-Regular': Size2Regular,
	'KaTeX_Size3-Regular': Size3Regular,
	'KaTeX_Size4-Regular': Size4Regular,
	'KaTeX_Typewriter-Regular': TypewriterRegular,
};

// Matches the whole `src:` list of a KaTeX @font-face rule, whose first entry
// is `url(fonts/<name>.woff2)` followed by WOFF and TTF fallbacks. Marp
// minifies CSS, so the list may end at `}` instead of `;`.
const fontSrc = /src:\s*url\(['"]?fonts\/(KaTeX_[\w-]+)\.woff2['"]?\)[^;}]*/g;

/**
 * Replaces the relative KaTeX font URLs in Marp's CSS (rendered with
 * `fontPath: false`) with the bundled WOFF2 data URLs.
 */
export function embedKatexFonts(css: string): string {
	return css.replace(fontSrc, (rule, name: string) => {
		const url = fonts[name];
		return url ? `src: url(${url}) format("woff2")` : rule;
	});
}
