import {
	createDefaultKeyboardInputConfig,
	KEYBOARD_INPUT_CONFIG_STORAGE_KEY,
	parseKeyboardInputConfig,
	serializeKeyboardInputConfig,
	type KeyboardInputConfig
} from '$lib/keyboardInputConfig';

class KeyboardInputStore {
	config = $state<KeyboardInputConfig>(createDefaultKeyboardInputConfig());
	hydrated = $state(false);

	hydrate() {
		let stored: string | null = null;
		try {
			if (typeof localStorage !== 'undefined') {
				stored = localStorage.getItem(KEYBOARD_INPUT_CONFIG_STORAGE_KEY);
			}
		} catch {
			stored = null;
		}
		this.config = parseKeyboardInputConfig(stored);
		this.hydrated = true;
	}

	setConfig(config: KeyboardInputConfig) {
		const serialized = serializeKeyboardInputConfig(config);
		this.config = parseKeyboardInputConfig(serialized);
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(KEYBOARD_INPUT_CONFIG_STORAGE_KEY, serialized);
			}
		} catch {
			// Ignore storage restrictions or quota errors.
		}
	}
}

export const keyboardInputStore = new KeyboardInputStore();
