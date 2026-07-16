<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();

	let showTooltip = $state(false);
	let triggerEl = $state<HTMLButtonElement | undefined>(undefined);
	let tooltipEl = $state<HTMLDivElement | undefined>(undefined);
	let coords = $state({ top: 0, left: 0 });

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function updatePosition() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		const tipWidth = tooltipEl?.offsetWidth ?? 256;
		const tipHeight = tooltipEl?.offsetHeight ?? 0;
		const gap = 8;
		const pad = 8;

		let left = rect.left + rect.width / 2;
		left = Math.min(window.innerWidth - pad - tipWidth / 2, Math.max(pad + tipWidth / 2, left));

		let top = rect.bottom + gap;
		if (top + tipHeight > window.innerHeight - pad && rect.top - gap - tipHeight >= pad) {
			top = rect.top - gap - tipHeight;
		}

		coords = { top, left };
	}

	function open() {
		showTooltip = true;
	}

	function close() {
		showTooltip = false;
	}

	$effect(() => {
		if (!showTooltip) return;

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

<span class="tooltip-root">
	<button
		bind:this={triggerEl}
		type="button"
		onmouseenter={open}
		onmouseleave={close}
		onfocus={open}
		onblur={close}
		class="tooltip-trigger"
		style="
			background-color: transparent;
			border: 1px solid var(--text-secondary);
			color: var(--text-secondary);
			--tw-ring-color: var(--accent);
		"
		aria-label="Help"
	>
		<span class="tooltip-trigger-mark">?</span>
	</button>
</span>

{#if showTooltip}
	<div
		bind:this={tooltipEl}
		use:portalToBody
		class="tooltip-popup"
		style="
			top: {coords.top}px;
			left: {coords.left}px;
			background-color: var(--bg-primary);
			border: 1px solid var(--border);
			color: var(--text-primary);
		"
		role="tooltip"
	>
		{text}
	</div>
{/if}

<style>
	.tooltip-root {
		display: inline-block;
		position: relative;
		vertical-align: middle;
	}

	.tooltip-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 9999px;
		outline: none;
		cursor: help;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.tooltip-trigger:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.tooltip-trigger-mark {
		font-size: 10px;
		font-weight: 500;
		line-height: 1;
	}

	.tooltip-popup {
		position: fixed;
		z-index: 100;
		transform: translateX(-50%);
		width: 16rem;
		max-width: min(16rem, calc(100vw - 1rem));
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		line-height: 1.35;
		white-space: pre-line;
		overflow-wrap: break-word;
		word-wrap: break-word;
		box-shadow: 0 10px 25px rgb(0 0 0 / 0.2);
		pointer-events: none;
	}
</style>
