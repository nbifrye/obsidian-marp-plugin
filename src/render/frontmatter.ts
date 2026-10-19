import { parseYaml } from 'obsidian';

const frontmatterBlock = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;

/**
 * Whether the note opts into Marp with a boolean `marp: true` in its
 * frontmatter. Reads the text itself rather than the metadata cache, so it
 * also works for unsaved editor contents.
 */
export function isMarpDocument(markdown: string): boolean {
	const match = frontmatterBlock.exec(markdown.replace(/^\uFEFF/, ''));
	if (!match) return false;
	try {
		const data: unknown = parseYaml(match[1] ?? '');
		return (
			typeof data === 'object' &&
			data !== null &&
			(data as Record<string, unknown>).marp === true
		);
	} catch {
		// Invalid YAML, e.g. while the properties are being typed.
		return false;
	}
}
