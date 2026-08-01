/**
 * Svelte action: append `node` to `document.body` so it escapes sticky/overflow
 * stacking contexts. Removes the node on destroy.
 */
export function portalToBody(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
