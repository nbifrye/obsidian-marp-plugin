/**
 * markdown-it plugin that records the source line each slide starts at, as
 * Marpit split them: front matter, `---` in code blocks and the
 * `headingDivider` directive are handled the same way as in the output.
 */

/** Render env field the first line (0-based) of each slide is pushed to. */
export interface SlideLinesEnv {
	slideLines?: number[];
}

// Minimal shapes of the markdown-it internals used here.
interface Token {
	type: string;
	map: [number, number] | null;
}
interface CoreState {
	inlineMode: boolean;
	env: SlideLinesEnv;
	tokens: Token[];
}
interface MarkdownIt {
	core: {
		ruler: { push(name: string, fn: (state: CoreState) => void): void };
	};
}

export function slideLinesPlugin(md: MarkdownIt): void {
	// Runs after Marpit's `marpit_slide`, which sets each slide's `map` to its
	// `---` (or hidden heading divider) or else its first block.
	md.core.ruler.push('marp_deck_slide_lines', (state) => {
		const lines = state.env.slideLines;
		if (state.inlineMode || !lines) return;
		for (const token of state.tokens) {
			if (token.type === 'marpit_slide_open') {
				// Lines before the first slide's content (e.g. the front
				// matter) belong to it.
				lines.push(lines.length === 0 ? 0 : (token.map?.[0] ?? 0));
			}
		}
	});
}

/** Index of the slide that contains the line, given each slide's first line. */
export function slideAtLine(
	slideLines: readonly number[],
	line: number,
): number {
	let index = 0;
	for (let i = 1; i < slideLines.length; i++) {
		if ((slideLines[i] ?? 0) > line) break;
		index = i;
	}
	return index;
}
