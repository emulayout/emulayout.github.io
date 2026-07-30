<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { uiPrefs } from '$lib/uiPrefs.svelte';

	let open = $state(false);
	let settingsButton = $state<HTMLButtonElement | undefined>(undefined);

	function close() {
		open = false;
		queueMicrotask(() => settingsButton?.focus());
	}
</script>

<div class="display-settings-menu">
	<button
		bind:this={settingsButton}
		type="button"
		onclick={() => (open = true)}
		class="flex items-center justify-center size-[34px] rounded-lg transition-all outline-none focus:ring-2 cursor-pointer"
		style="
			background-color: var(--bg-secondary);
			color: var(--text-primary);
			border: 1px solid {open ? 'var(--accent)' : 'var(--border)'};
			--tw-ring-color: var(--accent);
		"
		aria-label="Display settings"
		aria-haspopup="dialog"
		aria-expanded={open}
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
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	</button>
</div>

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

<ModalShell
	{open}
	onClose={close}
	labelledBy="display-settings-title"
	panelClass="max-h-[calc(100dvh-2rem)] max-w-lg w-[min(100%,28rem)]"
	initialFocusSelector=".display-settings-mode-option--active"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<h2
			id="display-settings-title"
			class="text-lg font-semibold"
			style="color: var(--text-primary);"
		>
			Display settings
		</h2>
		<button
			type="button"
			onclick={close}
			class="flex size-8 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="display-settings-body px-5 py-4">
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
					<div class="display-settings-nested-options">
						<div class="display-settings-mode-row">
							<span class="display-settings-copy">
								<span id="finger-usage-display-label" class="display-settings-label"
									>Finger usage</span
								>
								<span class="display-settings-desc">
									Choose how finger usage appears within card stats.
								</span>
							</span>
							<div
								class="display-settings-mode-control"
								role="group"
								aria-labelledby="finger-usage-display-label"
							>
								<button
									type="button"
									class="display-settings-mode-option"
									class:display-settings-mode-option--active={!uiPrefs.fingerUsageBars}
									aria-pressed={!uiPrefs.fingerUsageBars}
									onclick={() => uiPrefs.setFingerUsageBars(false)}>Text</button
								>
								<button
									type="button"
									class="display-settings-mode-option"
									class:display-settings-mode-option--active={uiPrefs.fingerUsageBars}
									aria-pressed={uiPrefs.fingerUsageBars}
									onclick={() => uiPrefs.setFingerUsageBars(true)}>Visual</button
								>
							</div>
						</div>
						{@render displaySetting(
							'finger-distance-display-label',
							'Finger distance',
							'Show the finger-distance graph in Visual mode. Applies only to Cyanophage stats.',
							uiPrefs.fingerDistanceBars,
							(enabled) => uiPrefs.setFingerDistanceBars(enabled)
						)}
					</div>
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
</ModalShell>

<style>
	.display-settings-menu {
		flex-shrink: 0;
	}

	.display-settings-body {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-height: 0;
		overflow-y: auto;
	}

	.display-settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
	}

	.display-settings-section:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.display-settings-section-options {
		display: flex;
		flex-direction: column;
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

	.display-settings-nested-options {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		color: white;
	}

	.display-settings-mode-option:focus-visible {
		box-shadow:
			0 0 0 2px var(--bg-secondary),
			0 0 0 4px var(--accent);
	}

	.display-settings-copy {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.display-settings-label {
		font-size: 0.875rem;
		line-height: 1.25;
		color: var(--text-primary);
		font-weight: 500;
	}

	.display-settings-desc {
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--text-secondary);
	}
</style>
