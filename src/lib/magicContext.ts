/** Spark contexts match Unicode code points; null consumes exactly one character. */
export type MagicContext = string | (string | null)[];

export function isMagicContext(value: unknown): value is MagicContext {
	return typeof value === 'string'
		? value.length > 0
		: Array.isArray(value) &&
				value.length > 0 &&
				value.every(
					(part) => part === null || (typeof part === 'string' && Array.from(part).length === 1)
				);
}

export function magicContextParts(context: MagicContext): (string | null)[] {
	return typeof context === 'string' ? Array.from(context) : context;
}

export function matchesMagicContext(history: string, context: MagicContext): boolean {
	const parts = magicContextParts(context);
	const characters = Array.from(history);
	return (
		characters.length >= parts.length &&
		parts.every(
			(part, index) =>
				part === null || part === characters[characters.length - parts.length + index]
		)
	);
}

/** Explicit pattern mode keeps old literal question marks and backslashes unchanged. */
export function parseMagicPattern(text: string): MagicContext | null {
	const parts: (string | null)[] = [];
	let escaped = false;
	for (const char of text) {
		if (escaped) {
			parts.push(char);
			escaped = false;
		} else if (char === '\\') escaped = true;
		else parts.push(char === '?' ? null : char);
	}
	return escaped || !parts.length ? null : parts;
}

export function formatMagicContext(context: MagicContext): string {
	if (typeof context === 'string') return context;
	return context
		.map((part) => (part === null ? '?' : part === '?' || part === '\\' ? `\\${part}` : part))
		.join('');
}
