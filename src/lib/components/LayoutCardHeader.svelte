<script lang="ts">
	import LayoutLikeButton from '$lib/components/LayoutLikeButton.svelte';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		selected: boolean;
		showLikes: boolean;
		showNewIndicator: boolean;
		showSimilarityMatch: boolean;
		showSelection?: boolean;
		authorInteractive?: boolean;
		similarMatchPercent?: number;
		similarMirrored?: boolean;
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
		showSelection = true,
		authorInteractive = true,
		similarMatchPercent,
		similarMirrored = false,
		onToggleSelection,
		onSelectAuthor
	}: Props = $props();

	const selectionId = $props.id();

	const updatedLabel = $derived.by(() => {
		if (!layout.updatedAt) return '';
		const updatedAt = new Date(layout.updatedAt);
		if (Number.isNaN(updatedAt.getTime())) return '';
		return updatedAt.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	});
</script>

{#snippet layoutTitle()}
	<h2
		class="text-lg font-semibold truncate min-w-0"
		style="color: var(--text-primary);"
		title={layout.name}
	>
		{layout.name}
	</h2>
{/snippet}

<div class="shrink-0 flex flex-col gap-1">
	<div class="flex items-center gap-2 min-w-0">
		<div class="flex items-center gap-2 min-w-0 flex-1">
			{#if showSelection}
				<div class="flex items-center gap-2 min-w-0">
					<span class="relative shrink-0 flex items-center">
						<input
							id={selectionId}
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
								style="color: var(--accent-fg);"
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
						<label for={selectionId} class="block truncate cursor-pointer">
							{layout.name}
						</label>
					</h2>
				</div>
			{:else}
				{@render layoutTitle()}
			{/if}
			{#if showNewIndicator}
				<span
					class="new-layout-dot shrink-0"
					title="New or updated layout"
					aria-label="New or updated layout"
				></span>
			{/if}
		</div>
		{#if showLikes}
			<LayoutLikeButton name={layout.name} {likeCount} />
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
		{#if authorName}<span class="shrink-0">by</span>{/if}
		{#if authorName}
			{#if authorInteractive}
				<button
					type="button"
					onclick={onSelectAuthor}
					class="hover:underline cursor-pointer truncate min-w-0"
					style="color: var(--text-secondary);"
					title={authorName}
				>
					{authorName}
				</button>
			{:else}
				<span class="truncate min-w-0" title={authorName}>{authorName}</span>
			{/if}
		{/if}
		{#if updatedLabel}
			<span class="shrink-0" title={layout.updatedAt}>· {updatedLabel}</span>
		{/if}
	</p>
</div>

<style>
	.new-layout-dot {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 9999px;
		background-color: var(--new-layout-dot);
	}
</style>
