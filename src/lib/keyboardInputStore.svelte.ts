import {
	cloneKeyboardInputConfig,
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
		this.config = parseKeyboardInputConfig(localStorage.getItem(KEYBOARD_INPUT_CONFIG_STORAGE_KEY));
		this.hydrated = true;
	}

	setConfig(config: KeyboardInputConfig) {
		this.config = cloneKeyboardInputConfig(config);
		localStorage.setItem(
			KEYBOARD_INPUT_CONFIG_STORAGE_KEY,
			serializeKeyboardInputConfig(this.config)
		);
	}
}

export const keyboardInputStore = new KeyboardInputStore();
