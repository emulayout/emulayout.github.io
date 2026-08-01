<script lang="ts">
	import { portalToBody } from '$lib/portalToBody';

	interface Props {
		/** Whether the popup is visible. */
		open: boolean;
		/** Element the popup is anchored to. */
		anchor: HTMLElement | null | undefined;
		text: string;
		/** Optional id for `aria-describedby` linkage. */
		id?: string;
		/** Wide help copy vs short value tip. */
		size?: 'default' | 'compact';
		/** Preferred side; flips when there isn’t room. */
		placement?: 'below' | 'above';
		/** Use tabular mono type (e.g. stat percentages). */
		mono?: boolean;
	}

	let {
		open,
		anchor,
		text,
		id,
		size = 'default',
		placement = 'below',
		mono = false
	}: Props = $props();

	let popupEl = $state<HTMLDivElement | undefined>(undefined);
	let coords = $state({ top: 0, left: 0 });

	function updatePosition() {
		if (!anchor) return;
		const rect = anchor.getBoundingClientRect();
		const tipWidth = popupEl?.offsetWidth ?? (size === 'compact' ? 40 : 256);
		const tipHeight = popupEl?.offsetHeight ?? 0;
		const gap = 8;
		const pad = 8;

		let left = rect.left + rect.width / 2;
		left = Math.min(window.innerWidth - pad - tipWidth / 2, Math.max(pad + tipWidth / 2, left));

		const belowTop = rect.bottom + gap;
		const aboveTop = rect.top - gap - tipHeight;
		const fitsBelow = belowTop + tipHeight <= window.innerHeight - pad;
		const fitsAbove = aboveTop >= pad;

		let top: number;
		if (placement === 'above') {
			top = fitsAbove || !fitsBelow ? aboveTop : belowTop;
		} else {
			top = fitsBelow || !fitsAbove ? belowTop : aboveTop;
		}

		coords = { top, left };
	}

	$effect(() => {
		if (!open) return;

		updatePosition();
		const frame = requestAnimationFrame(updatePosition);

		window.addEventListener('scroll', updatePosition, true);
		window.addEventListener('resize', updatePosition);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', updatePosition, true);
			window.removeEventListener('resize', updatePosition);
		};
	});
</script>

{#if open && text}
	<div
		bind:this={popupEl}
		{id}
		use:portalToBody
		class="hover-popup"
		class:hover-popup--default={size === 'default'}
		class:hover-popup--compact={size === 'compact'}
		class:hover-popup--mono={mono}
		style="top: {coords.top}px; left: {coords.left}px;"
		role="tooltip"
	>
		{text}
	</div>
{/if}

<style>
	.hover-popup {
		position: fixed;
		z-index: 100;
		transform: translateX(-50%);
		max-width: min(16rem, calc(100vw - 1rem));
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		color: var(--text-primary);
		box-shadow: 0 10px 25px rgb(0 0 0 / 0.2);
		pointer-events: none;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.hover-popup--default {
		width: 16rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.75rem;
		line-height: 1.35;
		white-space: pre-line;
	}

	.hover-popup--compact {
		width: max-content;
		padding: 0.25rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		line-height: 1.2;
		white-space: nowrap;
	}

	.hover-popup--mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
