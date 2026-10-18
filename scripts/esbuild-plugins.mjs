import { readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const mimeTypes = { '.woff2': 'font/woff2' };

/**
 * Resolves a file inside a package even when the package's "exports" do not
 * list it (e.g. Marp Core's prebuilt browser script).
 */
export function resolvePackageFile(request, from = process.cwd()) {
	try {
		return require.resolve(request, { paths: [from] });
	} catch {
		const parts = request.split('/');
		const name = parts.slice(0, request.startsWith('@') ? 2 : 1).join('/');
		const pkg = require.resolve(`${name}/package.json`, { paths: [from] });
		return path.join(
			path.dirname(pkg),
			...parts.slice(name.split('/').length),
		);
	}
}

/**
 * Supports Vite-style `?raw` (file contents as a string) and `?inline` (file
 * as a data URL) imports, so the same source works in esbuild and Vitest.
 */
export const assetQueryPlugin = {
	name: 'asset-query',
	setup(build) {
		build.onResolve({ filter: /\?(raw|inline)$/ }, (args) => {
			const [request, query] = args.path.split('?');
			const resolved = request.startsWith('.')
				? path.resolve(args.resolveDir, request)
				: resolvePackageFile(request, args.resolveDir);
			return { path: resolved, namespace: `asset-${query}` };
		});
		build.onLoad(
			{ filter: /.*/, namespace: 'asset-raw' },
			async (args) => ({
				contents: await readFile(args.path, 'utf8'),
				loader: 'text',
			}),
		);
		build.onLoad(
			{ filter: /.*/, namespace: 'asset-inline' },
			async (args) => {
				const mime =
					mimeTypes[path.extname(args.path)] ??
					'application/octet-stream';
				const data = (await readFile(args.path)).toString('base64');
				return {
					contents: `data:${mime};base64,${data}`,
					loader: 'text',
				};
			},
		);
	},
};

/**
 * Fails the build when a Node builtin ends up as an import of main.js: they
 * are external, so the build would succeed and only break on mobile.
 */
export function checkNoNodeBuiltins(metafile) {
	const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
	const found = new Set();
	for (const output of Object.values(metafile.outputs)) {
		for (const imported of output.imports) {
			if (builtins.has(imported.path)) found.add(imported.path);
		}
	}
	if (found.size > 0) {
		throw new Error(
			`main.js imports Node builtins, which do not exist on mobile: ${[...found].join(', ')}`,
		);
	}
}
