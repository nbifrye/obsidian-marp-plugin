import type { Metafile, Plugin } from 'esbuild';

export function resolvePackageFile(request: string, from?: string): string;
export const assetQueryPlugin: Plugin;
export function checkNoNodeBuiltins(metafile: Metafile): void;
