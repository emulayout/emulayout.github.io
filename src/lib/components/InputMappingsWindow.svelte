<script lang="ts">
	import { onMount } from 'svelte';
	import InputMappingsPanel from '$lib/components/InputMappingsPanel.svelte';
	import { inputProfileMappingsLabel, type LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import { portalToBody } from '$lib/portalToBody';

	interface Props {
		layoutName: string;
		profile: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		onClose: () => void;
	}

	const {
		layoutName,
		profile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		onClose
	}: Props = $props();
	const mappingsLabel = $derived(inputProfileMappingsLabel(profile));

	let panelElement = $state<HTMLDivElement>();
	let left = $state(16);
	let top = $state(16);
	let positioned = $state(false);
	let drag = $state<
		| {
				pointerId: number;
				offsetX: number;
				offsetY: number;
		  }
		| undefined
	>();

	const titleId = $derived(`input-mappings-window-${layoutName.replace(/[^a-zA-Z0-9_-]/g, '_')}`);

	function clampPosition(nextLeft: number, nextTop: number) {
		if (!panelElement) return { left: nextLeft, top: nextTop };
		const margin = 8;
		const maxLeft = Math.max(margin, window.innerWidth - panelElement.offsetWidth - margin);
		const maxTop = Math.max(margin, window.innerHeight - panelElement.offsetHeight - margin);
		return {
			left: Math.min(Math.max(nextLeft, margin), maxLeft),
			top: Math.min(Math.max(nextTop, margin), maxTop)
		};
	}

	function centerWindow() {
		if (!panelElement) return;
		const position = clampPosition(
			(window.innerWidth - panelElement.offsetWidth) / 2,
			(window.innerHeight - panelElement.offsetHeight) / 2
		);
		left = position.left;
		top = position.top;
		positioned = true;
	}

	function keepWindowInViewport() {
		const position = clampPosition(left, top);
		left = position.left;
		top = position.top;
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !panelElement) return;
		if (!(event.currentTarget instanceof HTMLElement)) return;

		const rect = panelElement.getBoundingClientRect();
		drag = {
			pointerId: event.pointerId,
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top
		};
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function handlePointerMove(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const position = clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
		left = position.left;
		top = position.top;
	}

	function handlePointerEnd(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (
			event.currentTarget instanceof HTMLElement &&
			event.currentTarget.hasPointerCapture(event.pointerId)
		) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		drag = undefined;
	}

	function handleDragKeyDown(event: KeyboardEvent) {
		const direction = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		}[event.key];
		if (!direction) return;

		const step = event.shiftKey ? 25 : 10;
		const position = clampPosition(left + direction[0] * step, top + direction[1] * step);
		left = position.left;
		top = position.top;
		positioned = true;
		event.preventDefault();
	}

	function handleWindowKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		event.preventDefault();
		onClose();
	}

	onMount(() => {
		const frame = requestAnimationFrame(centerWindow);
		return () => cancelAnimationFrame(frame);
	});
</script>

<svelte:window onkeydown={handleWindowKeyDown} onresize={keepWindowInViewport} />

<div
	use:portalToBody
	bind:this={panelElement}
	class="input-mappings-window"
	class:input-mappings-window--positioned={positioned}
	style:left={`${left}px`}
	style:top={`${top}px`}
	role="dialog"
	aria-labelledby={titleId}
>
	<div class="input-mappings-window-header">
		<button
			type="button"
			class="input-mappings-window-drag-handle"
			class:input-mappings-window-drag-handle--dragging={Boolean(drag)}
			aria-label={`Drag ${layoutName} ${mappingsLabel} window`}
			onkeydown={handleDragKeyDown}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerEnd}
			onpointercancel={handlePointerEnd}
		>
			<span id={titleId} title={layoutName}>{layoutName} {mappingsLabel}</span>
		</button>
		<button type="button" onclick={onClose} aria-label={`Close ${mappingsLabel}`}>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<path d="M6 6l12 12M18 6 6 18" />
			</svg>
		</button>
	</div>
	<div class="input-mappings-window-body">
		<InputMappingsPanel {profile} {disabledMappingIds} {onDisabledMappingIdsChange} />
	</div>
</div>

<style>
	.input-mappings-window {
		position: fixed;
		/* Above page chrome (z-40), below takeover modals and their backdrops (z-50). */
		z-index: 45;
		display: flex;
		width: min(34rem, calc(100vw - 1rem));
		max-height: calc(100vh - 1rem);
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background-color: var(--bg-secondary);
		box-shadow:
			0 18px 45px rgb(0 0 0 / 0.3),
			0 4px 12px rgb(0 0 0 / 0.18);
		opacity: 0;
	}

	.input-mappings-window--positioned {
		opacity: 1;
	}

	.input-mappings-window-header {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.input-mappings-window-drag-handle {
		display: block;
		min-width: 0;
		flex: 1;
		padding: 0.625rem 0 0.625rem 0.75rem;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		cursor: grab;
		text-align: left;
		touch-action: none;
		user-select: none;
	}

	.input-mappings-window-drag-handle--dragging {
		cursor: grabbing;
	}

	.input-mappings-window-drag-handle span {
		display: block;
		min-width: 0;
		overflow: hidden;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.input-mappings-window-header > button:last-child {
		display: inline-flex;
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 9999px;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		margin-right: 0.5rem;
	}

	.input-mappings-window-header > button:last-child:hover {
		background-color: var(--bg-primary);
		color: var(--text-primary);
	}

	.input-mappings-window-header button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.input-mappings-window-body {
		min-height: 0;
		padding: 0.75rem;
		overflow: auto;
	}
</style>
