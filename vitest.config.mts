import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { resolvePackageFile } from './scripts/esbuild-plugins.mjs';

const browserScript = '@marp-team/marp-core/lib/browser-iife.iife.js';

export default defineConfig({
	resolve: {
		alias: [
			// Not in the package's "exports"; esbuild resolves it the same way.
			// A pattern so that `?raw` imports resolve too.
			{
				find: /^@marp-team\/marp-core\/lib\/browser-iife\.iife\.js(?=\?|$)/,
				replacement: resolvePackageFile(browserScript),
			},
			{
				find: 'obsidian',
				replacement: fileURLToPath(
					new URL('./test/mocks/obsidian.ts', import.meta.url),
				),
			},
		],
	},
	test: {
		include: ['test/unit/**/*.test.ts'],
	},
});
