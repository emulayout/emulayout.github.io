<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lockPageScroll, trackOpenModal } from '$lib/modalScrollLock';

	interface Props {
		open: boolean;
		onClose: () => void;
		/** `id` of the dialog title element. */
		labelledBy: string;
		/** Extra classes for the dialog panel (width/height constraints). */
		panelClass?: string;
		children: Snippet;
	}

	let { open, onClose, labelledBy, panelClass = '', children }: Props = $props();

	let panelEl = $state<HTMLDivElement | undefined>(undefined);

	const FOCUSABLE_SELECTOR = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(', ');

	function getFocusableElements(container: HTMLElement): HTMLElement[] {
		return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
			if (el.closest('[inert], [aria-hidden="true"]')) return false;
			// offsetParent is null for fixed/hidden; also check visibility roughly.
			const style = window.getComputedStyle(el);
			if (style.visibility === 'hidden' || style.display === 'none') return false;
			return true;
		});
	}

	/** Prefer the first form field; fall back to first focusable control, then the panel. */
	function getInitialFocus(container: HTMLElement): HTMLElement {
		const formField = container.querySelector<HTMLElement>(
			'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
		);
		if (formField) return formField;

		const focusables = getFocusableElements(container);
		const nonClose = focusables.find((el) => el.getAttribute('aria-label') !== 'Close');
		return nonClose ?? focusables[0] ?? container;
	}

	/** Escape sticky/overflow stacking contexts so the overlay always paints above page content. */
	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	$effect(() => {
		if (!open) return;
		return trackOpenModal();
	});

	$effect(() => {
		if (!open) return;

		const unlock = lockPageScroll();
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}

			if (event.key !== 'Tab' || !panelEl) return;

			const focusables = getFocusableElements(panelEl);
			if (focusables.length === 0) {
				event.preventDefault();
				panelEl.focus();
				return;
			}

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;

			if (event.shiftKey && (active === first || !panelEl.contains(active))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (active === last || !panelEl.contains(active))) {
				event.preventDefault();
				first.focus();
			}
		}

		document.addEventListener('keydown', handleKeyDown);

		// Defer past the activating keyup (e.g. Space on the trigger) so it doesn't type into inputs.
		const focusTimer = window.setTimeout(() => {
			if (!panelEl) return;
			getInitialFocus(panelEl).focus();
		}, 0);

		return () => {
			window.clearTimeout(focusTimer);
			document.removeEventListener('keydown', handleKeyDown);
			unlock();
			if (previouslyFocused && document.contains(previouslyFocused)) {
				previouslyFocused.focus();
			}
		};
	});

	function blockBackgroundScroll(event: Event) {
		event.preventDefault();
	}
</script>

{#if open}
	<div use:portalToBody class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="modal-backdrop absolute inset-0"
			role="presentation"
			onclick={onClose}
			onwheel={blockBackgroundScroll}
			ontouchmove={blockBackgroundScroll}
		></div>

		<div
			bind:this={panelEl}
			class="modal-panel relative z-10 flex min-h-0 w-full flex-col rounded-2xl shadow-xl {panelClass}"
			style="background-color: var(--bg-primary); border: 1px solid var(--border);"
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledBy}
			tabindex="-1"
		>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		background-color: rgb(0 0 0 / 0.4);
	}

	:global(html.dark) .modal-backdrop {
		background-color: rgb(0 0 0 / 0.8);
	}

	.modal-panel:focus {
		outline: none;
	}
</style>
