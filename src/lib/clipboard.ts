export async function copyTextToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Fall through to the legacy selection-based copy path.
	}

	const previouslyFocused =
		document.activeElement instanceof HTMLElement ? document.activeElement : null;
	let textarea: HTMLTextAreaElement | null = null;
	try {
		textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'fixed';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.select();
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		textarea?.remove();
		if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
	}
}
