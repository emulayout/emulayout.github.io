/**
 * Shell UI preferences shared across the app (app bar, tooltips, etc.).
 */
class UiPrefs {
	/** When true, help `Tooltip`s are shown. Off by default. */
	hintsEnabled = $state(false);
	/** Visual finger-usage bars are the default; users can prefer the text rows locally. */
	fingerUsageBars = $state(true);

	hydrate() {
		this.hintsEnabled = localStorage.getItem('hintsEnabled') === 'true';
		this.fingerUsageBars = localStorage.getItem('fingerUsageDisplay') !== 'text';
	}

	toggleHints() {
		this.hintsEnabled = !this.hintsEnabled;
		localStorage.setItem('hintsEnabled', String(this.hintsEnabled));
	}

	setFingerUsageBars(value: boolean) {
		this.fingerUsageBars = value;
		localStorage.setItem('fingerUsageDisplay', value ? 'visual' : 'text');
	}
}

export const uiPrefs = new UiPrefs();
