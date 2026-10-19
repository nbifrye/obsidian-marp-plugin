import { describe, expect, it } from 'vitest';
import { isMarpDocument } from '../../src/render/frontmatter';

describe('isMarpDocument', () => {
	it.each([
		['---\nmarp: true\n---\n# A', true],
		['---\r\ntitle: x\r\nmarp:   true  # deck\r\n---\r\n', true],
		['﻿---\nmarp: true\n---', true],
		['---\n"marp": true\n---\n', true],
		['---\nmarp: TRUE\n---\n', true],
		['---\n{marp: true}\n---\n', true],
		['---\nmarp: true\n---', true],
		['---\nmarp: [\n---\n', false],
		['---\nmarp: false\n---\n', false],
		['---\nmarp: "true"\n---\n', false],
		['---\nnotmarp: true\n---\n', false],
		['# Title\n\n---\nmarp: true\n---\n', false],
		['marp: true', false],
	])('%j → %s', (text, expected) => {
		expect(isMarpDocument(text)).toBe(expected);
	});
});
