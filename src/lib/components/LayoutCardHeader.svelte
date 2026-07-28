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
		hasMagicKeyMappings?: boolean;
		magicKeyMappingsUnavailable?: boolean;
		magicKeyMappingsActive?: boolean;
		magicKeyMappingsFloatingActive?: boolean;
		onToggleMagicKeyMappings?: () => void;
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
		hasMagicKeyMappings = false,
		magicKeyMappingsUnavailable = false,
		magicKeyMappingsActive = false,
		magicKeyMappingsFloatingActive = false,
		onToggleMagicKeyMappings,
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
	const magicKeyTitle = $derived(
		magicKeyMappingsActive
			? magicKeyMappingsFloatingActive
				? 'Close magic key mappings'
				: 'Show layout stats'
			: 'Show magic key mappings'
	);
</script>

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
			{#if hasMagicKeyMappings}
				{#if onToggleMagicKeyMappings}
					<button
						type="button"
						class="magic-key-indicator magic-key-indicator--button"
						class:magic-key-indicator--active={magicKeyMappingsActive}
						onclick={onToggleMagicKeyMappings}
						title={magicKeyTitle}
						aria-label={magicKeyTitle}
						aria-pressed={magicKeyMappingsActive}
					>
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
					</button>
				{:else}
					<span
						class="magic-key-indicator"
						title={magicKeyMappingsUnavailable
							? 'Magic key mappings unavailable'
							: 'Magic key mappings available'}
						aria-label={magicKeyMappingsUnavailable
							? 'Magic key mappings unavailable'
							: 'Magic key mappings available'}
					>
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
							<path
								d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
							/>
						</svg>
					</span>
				{/if}
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
	.magic-key-indicator {
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

	.magic-key-indicator--button {
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			opacity 0.15s ease;
	}

	.magic-key-indicator--button:hover {
		background-color: var(--bg-primary);
		opacity: 1;
	}

	.magic-key-indicator--button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
		opacity: 1;
	}

	.magic-key-indicator--active {
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
