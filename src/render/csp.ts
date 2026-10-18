export interface CspOptions {
	blockExternalResources: boolean;
	/** Origin of vault resource URLs, see vaultResourceOrigin(). */
	resourceOrigin: string;
	/** Hashes (`sha256-…`) of inline scripts allowed to run. */
	scriptHashes?: string[];
}

/**
 * Content Security Policy for every document that shows slides: no scripts
 * (except hashed ones in exported HTML), plugins, frames, base URL or form
 * submission; network loads only when external resources are allowed.
 */
export function buildCsp(options: CspOptions): string {
	const local = ['data:', 'blob:', options.resourceOrigin].filter(Boolean);
	const remote = options.blockExternalResources ? [] : ['https:', 'http:'];
	const sources = [...local, ...remote].join(' ');
	const scripts = options.scriptHashes?.length
		? options.scriptHashes.map((h) => `'${h}'`).join(' ')
		: "'none'";
	return [
		"default-src 'none'",
		`script-src ${scripts}`,
		`style-src 'unsafe-inline' ${sources}`,
		`img-src ${sources}`,
		`font-src ${sources}`,
		`media-src ${sources}`,
		"object-src 'none'",
		"frame-src 'none'",
		"child-src 'none'",
		"worker-src 'none'",
		"connect-src 'none'",
		"manifest-src 'none'",
		"base-uri 'none'",
		"form-action 'none'",
	].join('; ');
}

export async function sha256Base64(text: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(text),
	);
	let binary = '';
	for (const byte of new Uint8Array(digest))
		binary += String.fromCharCode(byte);
	return `sha256-${btoa(binary)}`;
}
