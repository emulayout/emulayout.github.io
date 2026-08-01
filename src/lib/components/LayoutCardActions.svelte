<script lang="ts">
	import { resolve } from '$app/paths';
	import DropdownMenu from '$lib/components/DropdownMenu.svelte';

	interface Props {
		markFirstAction: boolean;
		similarActive: boolean;
		hasSimilarReference: boolean;
		anglemodActive: boolean;
		angleBoard: boolean;
		cyanophageCompatible: boolean;
		cyanophageTitle: string;
		expandLayoutName?: string;
		expandSearch?: string;
		forceIncluded: boolean;
		onFindSimilar: () => void;
		onToggleAnglemod: () => void;
		onPractice: () => void | Promise<void>;
		onOpenPlayground: () => void | Promise<void>;
	}

	const {
		markFirstAction,
		similarActive,
		hasSimilarReference,
		anglemodActive,
		angleBoard,
		cyanophageCompatible,
		cyanophageTitle,
		expandLayoutName,
		expandSearch = '',
		forceIncluded,
		onFindSimilar,
		onToggleAnglemod,
		onPractice,
		onOpenPlayground
	}: Props = $props();

	const similarityTitle = $derived(
		similarActive
			? 'Stop showing similar layouts'
			: hasSimilarReference
				? 'Show layouts similar to this one'
				: 'Find similar layouts'
	);
	const anglemodTitle = $derived(angleBoard ? 'Remove anglemod' : 'Anglemod');
	const expandTarget = $derived(
		`/layouts/[name]${expandSearch}` as '/layouts/[name]' | `/layouts/[name]?${string}`
	);

	let externalLinksOpen = $state(false);
</script>

<div class="card-action-divider shrink-0" aria-label="Layout actions">
	<div class="card-action-toolbar" class:card-action-toolbar--force-included={forceIncluded}>
		<button
			type="button"
			onclick={onFindSimilar}
			data-layout-card-first-action={markFirstAction ? true : undefined}
			class="card-action-button"
			class:card-action-button--similar={similarActive}
			title={similarityTitle}
			aria-label={similarityTitle}
			aria-pressed={similarActive}
		>
			<svg
				class="size-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="7" height="7" rx="1" />
				<rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" />
				<rect x="14" y="14" width="7" height="7" rx="1" />
			</svg>
		</button>
		<button
			type="button"
			onclick={onToggleAnglemod}
			class="card-action-button"
			class:card-action-button--accent={anglemodActive}
			title={anglemodTitle}
			aria-label={anglemodTitle}
			aria-pressed={anglemodActive}
		>
			<svg
				class="size-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
				<path d="M21 3v5h-5" />
				<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
				<path d="M3 21v-5h5" />
			</svg>
		</button>
		<DropdownMenu bind:open={externalLinksOpen} menuLabel="External links">
			{#snippet trigger({ open, toggle, triggerProps })}
				<button
					type="button"
					onclick={toggle}
					class="card-action-button"
					class:card-action-button--accent={open}
					title="External links"
					aria-label="External links"
					{...triggerProps}
				>
					<svg
						class="size-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
						/>
					</svg>
				</button>
			{/snippet}
			{#snippet children({ close })}
				<button
					type="button"
					role="menuitem"
					class="external-links-menu-item"
					disabled={!cyanophageCompatible}
					title={cyanophageCompatible ? undefined : cyanophageTitle}
					aria-disabled={!cyanophageCompatible}
					onclick={() => {
						close();
						void onOpenPlayground();
					}}
				>
					View in Cyanophage playground
				</button>
				<button
					type="button"
					role="menuitem"
					class="external-links-menu-item"
					onclick={() => {
						close();
						void onPractice();
					}}
				>
					Practice typing on Colemak Camp
				</button>
			{/snippet}
		</DropdownMenu>
		{#if expandLayoutName}
			<a
				href={resolve(expandTarget, { name: expandLayoutName })}
				class="card-action-button"
				title="View layout details"
				aria-label="View layout details"
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M15 3h6v6" />
					<path d="M9 21H3v-6" />
					<path d="M21 3l-7 7" />
					<path d="M3 21l7-7" />
				</svg>
			</a>
		{/if}
	</div>
</div>

<style>
	.card-action-divider {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.25rem 0;
	}

	.card-action-divider::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid var(--border);
		pointer-events: none;
	}

	.card-action-toolbar {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.375rem;
		background-color: var(--bg-secondary);
	}

	.card-action-toolbar--force-included {
		background-color: var(--bg-primary);
	}

	.card-action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		cursor: pointer;
		text-decoration: none;
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
		transition:
			background-color 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease,
			box-shadow 0.12s ease,
			transform 0.08s ease;
	}

	.card-action-button:hover:not(:disabled) {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	.card-action-button:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: none;
		background-color: color-mix(in srgb, var(--accent) 26%, var(--bg-primary));
		border-color: var(--accent);
	}

	.card-action-button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.card-action-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}

	.card-action-button--accent {
		color: white;
		background-color: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 18%, transparent);
	}

	.card-action-button--accent:hover:not(:disabled) {
		color: white;
		background-color: color-mix(in srgb, var(--accent) 88%, black);
		border-color: color-mix(in srgb, var(--accent) 88%, black);
	}

	.card-action-button--accent:active:not(:disabled) {
		background-color: color-mix(in srgb, var(--accent) 78%, black);
		border-color: color-mix(in srgb, var(--accent) 78%, black);
	}

	.card-action-button--similar {
		color: var(--similar-active-fg);
		background-color: var(--similar-diff);
		border-color: var(--similar-diff);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 18%, transparent);
	}

	.card-action-button--similar:hover:not(:disabled) {
		color: var(--similar-active-fg);
		background-color: color-mix(in srgb, var(--similar-diff) 88%, black);
		border-color: color-mix(in srgb, var(--similar-diff) 88%, black);
	}

	.card-action-button--similar:active:not(:disabled) {
		background-color: color-mix(in srgb, var(--similar-diff) 78%, black);
		border-color: color-mix(in srgb, var(--similar-diff) 78%, black);
	}

	.external-links-menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}

	.external-links-menu-item:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
	}

	.external-links-menu-item:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.external-links-menu-item:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
