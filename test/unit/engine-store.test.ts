import { describe, expect, it, vi } from 'vitest';
import { App } from 'obsidian';
import MarpPlugin from '../../src/main';
import * as themes from '../../src/render/themes';

describe('EngineStore', () => {
	it('retries after a failed build', async () => {
		const plugin = new MarpPlugin(new App(), {} as never);
		await plugin.loadSettings();
		const read = vi
			.spyOn(themes, 'readThemeSources')
			.mockRejectedValueOnce(new Error('temporary'))
			.mockResolvedValue([]);

		await expect(plugin.engines.get()).rejects.toThrow('temporary');
		await expect(plugin.engines.get()).resolves.toBeDefined();
		expect(read).toHaveBeenCalledTimes(2);
	});
});
