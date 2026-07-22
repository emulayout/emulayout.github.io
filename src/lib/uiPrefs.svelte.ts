/**
 * Shell UI preferences shared across the app (app bar, tooltips, etc.).
 */
class UiPrefs {
	/** When true, help `Tooltip`s are shown. Off by default. */
	hintsEnabled = $state(false);

	hydrate() {
		this.hintsEnabled = localStorage.getItem('hintsEnabled') === 'true';
	}

	toggleHints() {
		this.hintsEnabled = !this.hintsEnabled;
		localStorage.setItem('hintsEnabled', String(this.hintsEnabled));
	}
}

export const uiPrefs = new UiPrefs();
