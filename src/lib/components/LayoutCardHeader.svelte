<script lang="ts">
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		selected: boolean;
		showLikes: boolean;
		showNewIndicator: boolean;
		showSimilarityMatch: boolean;
		similarMatchPercent?: number;
		similarMirrored?: boolean;
		hasInputMappings?: boolean;
		hasAdaptiveSwapMappings?: boolean;
		mappingsLabel?: string;
		inputMappingsUnavailable?: boolean;
		inputMappingsActive?: boolean;
		inputMappingsFloatingActive?: boolean;
		onToggleInputMappings?: () => void;
		onToggleSelection: () => void;
		onSelectAuthor: () => void;
	}

	const {
		layout,
		authorName,
		likeCount,
		selected,
		showLikes,
		showNewIndicator,
		showSimilarityMatch,
		similarMatchPercent,
		similarMirrored = false,
		hasInputMappings = false,
		hasAdaptiveSwapMappings = false,
		mappingsLabel = 'input mappings',
		inputMappingsUnavailable = false,
		inputMappingsActive = false,
		inputMappingsFloatingActive = false,
		onToggleInputMappings,
		onToggleSelection,
		onSelectAuthor
	}: Props = $props();

	const updatedLabel = $derived(
		new Date(layout.updatedAt).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);
	const accessibleMappingsLabel = $derived(
		mappingsLabel.charAt(0).toUpperCase() + mappingsLabel.slice(1)
	);
	const mappingsTitle = $derived(
		inputMappingsActive
			? inputMappingsFloatingActive
				? `Close ${mappingsLabel}`
				: 'Show layout stats'
			: `Show ${mappingsLabel}`
	);
</script>

{#snippet adaptiveSwapIcon()}
	<svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<!-- Material Insights icon paths, inlined to avoid a MUI dependency. -->
		<path
			d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2"
		/>
		<path
			d="m15 9 .94-2.07L18 6l-2.06-.93L15 3l-.92 2.07L12 6l2.08.93zM3.5 11 4 9l2-.5L4 8l-.5-2L3 8l-2 .5L3 9z"
		/>
	</svg>
{/snippet}

{#snippet magicKeyIcon()}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<!-- Lucide sparkles style (inline; no icon pack dependency) -->
		<path
			d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
		/>
	</svg>
{/snippet}

{#snippet mappingsIcon()}
	{#if hasAdaptiveSwapMappings && !layout.hasMagicKeyMappings}
		{@render adaptiveSwapIcon()}
	{:else}
		{@render magicKeyIcon()}
	{/if}
{/snippet}

<div class="shrink-0 flex flex-col gap-1">
	<div class="flex items-center gap-2 min-w-0">
		<div class="flex items-center gap-2 min-w-0 flex-1">
			<label class="flex items-center gap-2 min-w-0 cursor-pointer">
				<span class="relative shrink-0 flex items-center">
					<input
						type="checkbox"
						checked={selected}
						onchange={onToggleSelection}
						class="size-4 rounded appearance-none cursor-pointer relative"
						style="
							background-color: {selected ? 'var(--accent)' : 'var(--bg-primary)'};
							border: 1px solid var(--border);
						"
						aria-label={`Select ${layout.name}`}
					/>
					{#if selected}
						<svg
							class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
							style="color: white;"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<h2
					class="text-lg font-semibold truncate min-w-0"
					style="color: var(--text-primary);"
					title={layout.name}
				>
					{layout.name}
				</h2>
			</label>
			{#if hasInputMappings}
				{#if onToggleInputMappings}
					<button
						type="button"
						class="input-mappings-indicator input-mappings-indicator--button"
						class:input-mappings-indicator--active={inputMappingsActive}
						onclick={onToggleInputMappings}
						title={mappingsTitle}
						aria-label={mappingsTitle}
						aria-pressed={inputMappingsActive}
					>
						{@render mappingsIcon()}
					</button>
				{:else}
					<span
						class="input-mappings-indicator"
						title={inputMappingsUnavailable
							? `${accessibleMappingsLabel} unavailable`
							: `${accessibleMappingsLabel} available`}
						aria-label={inputMappingsUnavailable
							? `${accessibleMappingsLabel} unavailable`
							: `${accessibleMappingsLabel} available`}
					>
						{@render mappingsIcon()}
					</span>
				{/if}
			{/if}
			{#if layout.hasAdaptiveSwap && !hasAdaptiveSwapMappings}
				<span
					class="input-mappings-indicator input-mappings-indicator--unavailable"
					title="Adaptive swap layout; mappings unavailable"
					aria-label="Adaptive swap layout; mappings unavailable"
				>
					{@render adaptiveSwapIcon()}
				</span>
			{/if}
			{#if layout.hasMagicKey && !layout.hasMagicKeyMappings}
				<span
					class="input-mappings-indicator input-mappings-indicator--unavailable"
					title="Magic key layout; mappings unavailable"
					aria-label="Magic key layout; mappings unavailable"
				>
					{@render magicKeyIcon()}
				</span>
			{/if}
			{#if showNewIndicator}
				<span class="new-layout-dot shrink-0" title="New layout" aria-label="New layout"></span>
			{/if}
		</div>
		{#if showLikes}
			<span
				class="inline-flex items-center gap-1 text-xs tabular-nums shrink-0"
				style="color: var(--text-secondary);"
				title="Likes"
				aria-label={`${likeCount} likes`}
			>
				<svg
					class="size-3.5 shrink-0"
					viewBox="0 0 24 24"
					fill={likeCount > 1 ? 'currentColor' : 'none'}
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
					/>
				</svg>
				{likeCount}
			</span>
		{/if}
		{#if showSimilarityMatch && similarMatchPercent !== undefined}
			<span
				class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium tabular-nums shrink-0"
				style="color: var(--similar-diff); background-color: var(--bg-primary); border: 1px solid var(--border);"
				title={similarMirrored ? 'Position match (mirrored)' : 'Position match'}
				aria-label={similarMirrored
					? `${similarMatchPercent}% mirrored match`
					: `${similarMatchPercent}% match`}
			>
				{similarMatchPercent}%
				{#if similarMirrored}
					<svg
						class="size-3.5 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<!-- Lucide flip-horizontal style (inline; no icon pack dep) -->
						<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
						<path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
						<path d="M12 20v2" />
						<path d="M12 14v2" />
						<path d="M12 8v2" />
						<path d="M12 2v2" />
					</svg>
				{/if}
			</span>
		{/if}
	</div>
	<p
		class="text-xs layout-meta flex items-center gap-1 min-w-0"
		style="color: var(--text-secondary);"
	>
		<span class="shrink-0">{layout.board} · by</span>
		<button
			type="button"
			onclick={onSelectAuthor}
			class="hover:underline cursor-pointer truncate min-w-0"
			style="color: var(--text-secondary);"
			title={authorName}
		>
			{authorName}
		</button>
		<span class="shrink-0" title={layout.updatedAt}>· {updatedLabel}</span>
	</p>
</div>

<style>
	.input-mappings-indicator {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0.125rem;
		border: 0;
		border-radius: 0.3rem;
		background: transparent;
		color: var(--text-primary);
		opacity: 0.72;
	}

	.input-mappings-indicator--unavailable {
		color: var(--text-secondary);
		opacity: 0.42;
	}

	.input-mappings-indicator--button {
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			opacity 0.15s ease;
	}

	.input-mappings-indicator--button:hover {
		background-color: var(--bg-primary);
		opacity: 1;
	}

	.input-mappings-indicator--button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
		opacity: 1;
	}

	.input-mappings-indicator--active {
		background-color: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
		opacity: 1;
	}

	.new-layout-dot {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 9999px;
		background-color: var(--new-layout-dot);
	}
</style>
