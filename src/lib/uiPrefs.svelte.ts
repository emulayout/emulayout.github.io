/**
 * Shell UI preferences shared across the app (app bar, tooltips, etc.).
 */
class UiPrefs {
	/** When true, help `Tooltip`s are shown. Off by default. */
	hintsEnabled = $state(false);
	/** Visual finger-usage bars are the default; users can prefer the text rows locally. */
	fingerUsageBars = $state(true);
	/** Cyanophage finger-distance bars are shown by default in the visual stats view. */
	fingerDistanceBars = $state(true);

	hydrate() {
		this.hintsEnabled = localStorage.getItem('hintsEnabled') === 'true';
		this.fingerUsageBars = localStorage.getItem('fingerUsageDisplay') !== 'text';
		this.fingerDistanceBars = localStorage.getItem('fingerDistanceDisplay') !== 'hidden';
	}

	toggleHints() {
		this.hintsEnabled = !this.hintsEnabled;
		localStorage.setItem('hintsEnabled', String(this.hintsEnabled));
	}

	setFingerUsageBars(value: boolean) {
		this.fingerUsageBars = value;
		localStorage.setItem('fingerUsageDisplay', value ? 'visual' : 'text');
	}

	setFingerDistanceBars(value: boolean) {
		this.fingerDistanceBars = value;
		localStorage.setItem('fingerDistanceDisplay', value ? 'visible' : 'hidden');
	}
}

export const uiPrefs = new UiPrefs();
