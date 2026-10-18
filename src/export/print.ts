import type { RenderResult } from '../render/engine';
import { SlideFrame } from '../ui/slide-frame';

/**
 * Prints every slide through the system print dialog (desktop only), from a
 * hidden frame laid out by Marp's print styles. Waits for fonts and images
 * so the printout is complete.
 */
export async function printSlides(
	result: RenderResult,
	resolveMedia: (url: string) => string | undefined,
	csp: string,
): Promise<void> {
	const host = activeDocument.body.createDiv({
		cls: 'marp-core-slides-print-host',
	});
	const frame = new SlideFrame(host, { mode: 'print', csp });
	try {
		await frame.show(result, resolveMedia);
		const doc = frame.document;
		const win = frame.iframe.contentWindow;
		if (!doc || !win) return;
		await Promise.all([
			doc.fonts.ready,
			...Array.from(doc.images).map((img) =>
				img.decode().catch(() => undefined),
			),
		]);
		win.focus();
		win.print();
	} finally {
		frame.destroy();
		host.remove();
	}
}
