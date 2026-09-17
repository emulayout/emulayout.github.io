import type { KeyboardGeometry } from '$lib/keyboardGeometry';

export const COLEMAK_CAMP_BASE_URL = 'https://emulayout.github.io/colemakcamp/';

export const CUSTOM_LAYOUT_URL_KEYS = [
	'KeyQ',
	'KeyW',
	'KeyE',
	'KeyR',
	'KeyT',
	'KeyY',
	'KeyU',
	'KeyI',
	'KeyO',
	'KeyP',
	'KeyR1',
	'BracketLeft',
	'BracketRight',
	'Backslash',
	'IntlBackslash',
	'KeyA',
	'KeyS',
	'KeyD',
	'KeyF',
	'KeyG',
	'KeyH',
	'KeyJ',
	'KeyK',
	'KeyL',
	'Semicolon',
	'Quote',
	'KeyR2',
	'KeyZ',
	'KeyX',
	'KeyC',
	'KeyV',
	'KeyB',
	'KeyN',
	'KeyM',
	'Comma',
	'Period',
	'Slash',
	'KeyR3'
] as const;

export function geometryToColemakCampKeyboard(
	geometry: KeyboardGeometry,
	anglemod = false
): string {
	if (geometry === 'column-stagger') return 'ortho';
	return anglemod ? 'iso' : 'ansi';
}

/** Matches Colemak Camp `app.js` — safe for non-ASCII layout characters. */
export function encodeBase64URL(value: string): string {
	return btoa(unescape(encodeURIComponent(value)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export function createColemakCampURL({
	baseURL = COLEMAK_CAMP_BASE_URL,
	keyboard,
	keys,
	levels
}: {
	baseURL?: string;
	keyboard: string;
	keys: Record<string, string>;
	levels?: unknown;
}): string {
	const payload: Record<string, unknown> = {
		v: 1,
		kb: keyboard,
		k: CUSTOM_LAYOUT_URL_KEYS.map((key) => keys[key] ?? '')
	};

	if (levels !== undefined) {
		payload.l = levels;
	}

	const url = new URL(baseURL);
	url.searchParams.set('layout', 'custom');
	url.searchParams.set('keyboard', keyboard);
	url.searchParams.set('level', '1');
	url.searchParams.set('mapping', 'on');
	url.searchParams.set('custom', 'v1:' + encodeBase64URL(JSON.stringify(payload)));

	return url.toString();
}

export function createColemakCampURLFromKeyMap(
	keyMap: Record<string, string>,
	geometry: KeyboardGeometry,
	anglemod = false,
	baseURL = COLEMAK_CAMP_BASE_URL
): string {
	return createColemakCampURL({
		baseURL,
		keyboard: geometryToColemakCampKeyboard(geometry, anglemod),
		keys: keyMap
	});
}
