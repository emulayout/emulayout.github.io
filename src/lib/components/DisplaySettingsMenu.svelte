<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

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
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	</button>
</div>

<ModalShell
	{open}
	onClose={close}
	labelledBy="display-settings-title"
	panelClass="max-w-md w-[min(100%,24rem)]"
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
		<label class="display-settings-row">
			<span class="display-settings-check">
				<input
					type="checkbox"
					checked={!filterStore.hideLayoutTestArea}
					onchange={(e) => filterStore.setHideLayoutTestArea(!e.currentTarget.checked)}
					class="size-4 rounded appearance-none cursor-pointer relative"
					style="
						background-color: {!filterStore.hideLayoutTestArea
						? 'var(--accent)'
						: 'var(--bg-primary)'};
						border: 1px solid var(--border);
					"
				/>
				{#if !filterStore.hideLayoutTestArea}
					<svg
						class="display-settings-check-mark"
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
			<span class="display-settings-copy">
				<span class="display-settings-label">Show test area</span>
			</span>
		</label>

		<label class="display-settings-row">
			<span class="display-settings-check">
				<input
					type="checkbox"
					checked={!filterStore.hideLayoutStats}
					onchange={(e) => filterStore.setHideLayoutStats(!e.currentTarget.checked)}
					class="size-4 rounded appearance-none cursor-pointer relative"
					style="
						background-color: {!filterStore.hideLayoutStats
						? 'var(--accent)'
						: 'var(--bg-primary)'};
						border: 1px solid var(--border);
					"
				/>
				{#if !filterStore.hideLayoutStats}
					<svg
						class="display-settings-check-mark"
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
			<span class="display-settings-copy">
				<span class="display-settings-label">Show stats</span>
			</span>
		</label>

		<label class="display-settings-row">
			<span class="display-settings-check">
				<input
					type="checkbox"
					checked={!filterStore.hideLayoutLikes}
					onchange={(e) => filterStore.setHideLayoutLikes(!e.currentTarget.checked)}
					class="size-4 rounded appearance-none cursor-pointer relative"
					style="
						background-color: {!filterStore.hideLayoutLikes
						? 'var(--accent)'
						: 'var(--bg-primary)'};
						border: 1px solid var(--border);
					"
				/>
				{#if !filterStore.hideLayoutLikes}
					<svg
						class="display-settings-check-mark"
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
			<span class="display-settings-copy">
				<span class="display-settings-label">Show likes</span>
			</span>
		</label>

		<label class="display-settings-row">
			<span class="display-settings-check">
				<input
					type="checkbox"
					checked={!filterStore.hideNewLayoutIndicator}
					onchange={(e) => filterStore.setHideNewLayoutIndicator(!e.currentTarget.checked)}
					class="size-4 rounded appearance-none cursor-pointer relative"
					style="
						background-color: {!filterStore.hideNewLayoutIndicator
						? 'var(--accent)'
						: 'var(--bg-primary)'};
						border: 1px solid var(--border);
					"
				/>
				{#if !filterStore.hideNewLayoutIndicator}
					<svg
						class="display-settings-check-mark"
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
			<span class="display-settings-copy">
				<span class="display-settings-label">Show new indicator</span>
			</span>
		</label>

		<label class="display-settings-row">
			<span class="display-settings-check">
				<input
					type="checkbox"
					checked={filterStore.stickySimilarityCard}
					onchange={(e) => filterStore.setStickySimilarityCard(e.currentTarget.checked)}
					class="size-4 rounded appearance-none cursor-pointer relative"
					style="
						background-color: {filterStore.stickySimilarityCard
						? 'var(--accent)'
						: 'var(--bg-primary)'};
						border: 1px solid var(--border);
					"
				/>
				{#if filterStore.stickySimilarityCard}
					<svg
						class="display-settings-check-mark"
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
			<span class="display-settings-copy">
				<span class="display-settings-label">Pin similarity reference</span>
				<span class="display-settings-desc">
					Keeps the reference layout locked in place while you scroll matching layouts, so you can
					compare them against the layout the similarities are based on from anywhere in the list.
				</span>
			</span>
		</label>
	</div>
</ModalShell>

<style>
	.display-settings-menu {
		flex-shrink: 0;
	}

	.display-settings-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.display-settings-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.875rem;
		line-height: 1.25;
	}

	.display-settings-check {
		position: relative;
		flex-shrink: 0;
		/* Same line box as .display-settings-label so the checkbox centers on the text. */
		height: 1.25em;
		display: inline-flex;
		align-items: center;
	}

	.display-settings-check-mark {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 1rem;
		height: 1rem;
		transform: translate(-50%, -50%);
		pointer-events: none;
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
