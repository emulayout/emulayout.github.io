<script lang="ts">
	import { filterStore } from '$lib/filterStore.svelte';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
</script>

{#snippet displaySetting(
	id: string,
	label: string,
	description: string,
	enabled: boolean,
	setEnabled: (enabled: boolean) => void
)}
	<div class="display-settings-mode-row">
		<span class="display-settings-copy">
			<span {id} class="display-settings-label">{label}</span>
			<span class="display-settings-desc">{description}</span>
		</span>
		<div class="display-settings-mode-control" role="group" aria-labelledby={id}>
			<button
				type="button"
				class="display-settings-mode-option"
				class:display-settings-mode-option--active={!enabled}
				aria-pressed={!enabled}
				onclick={() => setEnabled(false)}>Off</button
			>
			<button
				type="button"
				class="display-settings-mode-option"
				class:display-settings-mode-option--active={enabled}
				aria-pressed={enabled}
				onclick={() => setEnabled(true)}>On</button
			>
		</div>
	</div>
{/snippet}

<div class="display-settings-body">
	<section class="display-settings-section" aria-labelledby="layout-card-settings-title">
		<h3 id="layout-card-settings-title" class="display-settings-section-title">Layout cards</h3>
		<div class="display-settings-section-options">
			{@render displaySetting(
				'new-layout-display-label',
				'New layout indicator',
				'Mark layouts added by the latest sync with a red dot.',
				!filterStore.hideNewLayoutIndicator,
				(enabled) => filterStore.setHideNewLayoutIndicator(!enabled)
			)}
			{@render displaySetting(
				'likes-display-label',
				'Likes',
				"Show each layout's like count in its card header.",
				!filterStore.hideLayoutLikes,
				(enabled) => filterStore.setHideLayoutLikes(!enabled)
			)}
			{@render displaySetting(
				'stats-display-label',
				'Stats',
				'Show analyzer statistics directly on layout cards.',
				!filterStore.hideLayoutStats,
				(enabled) => filterStore.setHideLayoutStats(!enabled)
			)}
			<div class="display-settings-nested-option">
				{@render displaySetting(
					'finger-distance-display-label',
					'Finger distance',
					'Show the finger-distance graph in Highlights. Applies only to Cyanophage stats.',
					uiPrefs.fingerDistanceBars,
					(enabled) => uiPrefs.setFingerDistanceBars(enabled)
				)}
			</div>
			{@render displaySetting(
				'test-area-display-label',
				'Test area',
				'Show a typing field on each card for trying the layout.',
				!filterStore.hideLayoutTestArea,
				(enabled) => filterStore.setHideLayoutTestArea(!enabled)
			)}
		</div>
	</section>

	<section class="display-settings-section" aria-labelledby="similarity-display-title">
		<h3 id="similarity-display-title" class="display-settings-section-title">
			Similarity comparison
		</h3>
		<div class="display-settings-section-options">
			{@render displaySetting(
				'similarity-reference-display-label',
				'Pin reference layout',
				'Keep the reference layout visible while scrolling through its similarity matches.',
				filterStore.stickySimilarityCard,
				(enabled) => filterStore.setStickySimilarityCard(enabled)
			)}
		</div>
	</section>
</div>

<style>
	.display-settings-body,
	.display-settings-section,
	.display-settings-section-options,
	.display-settings-copy {
		display: flex;
		flex-direction: column;
	}

	.display-settings-body {
		gap: 1.25rem;
	}

	.display-settings-section {
		gap: 0.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
	}

	.display-settings-section:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.display-settings-section-options {
		gap: 1rem;
	}

	.display-settings-section-title {
		margin: 0;
		color: var(--text-caption);
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.display-settings-nested-option {
		margin-left: 0.25rem;
		padding-left: 0.75rem;
		border-left: 2px solid color-mix(in srgb, var(--accent) 24%, var(--border));
	}

	.display-settings-mode-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.875rem;
		line-height: 1.25;
	}

	.display-settings-mode-control {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		flex-shrink: 0;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-primary);
	}

	.display-settings-mode-option {
		min-width: 3.75rem;
		padding: 0.35rem 0.6rem;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.2;
		cursor: pointer;
		outline: none;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.display-settings-mode-option--active {
		background: var(--accent);
		color: var(--accent-fg);
	}

	.display-settings-mode-option:focus-visible {
		box-shadow:
			0 0 0 2px var(--bg-secondary),
			0 0 0 4px var(--accent);
	}

	.display-settings-copy {
		gap: 0.25rem;
		min-width: 0;
	}

	.display-settings-label {
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25;
	}

	.display-settings-desc {
		color: var(--text-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
	}
</style>
