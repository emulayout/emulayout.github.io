/** UTF-8 base64url transport shared by current creator documents and legacy queries. */
export function encodeBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64Url(value: string): string | null {
	try {
		const padded = value.replace(/-/g, '+').replace(/_/g, '/');
		const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
		const binary = atob(padded + pad);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}
