<script lang="ts">
	interface SelectableView {
		key: string;
		name: string;
	}

	interface Props {
		legend: string;
		views: SelectableView[];
		selectedKeys: Set<string>;
		onChange: (selectedKeys: Set<string>) => void;
		emptyMessage: string;
	}

	let { legend, views, selectedKeys, onChange, emptyMessage }: Props = $props();

	function setSelected(key: string, selected: boolean) {
		onChange(
			selected
				? new Set([...selectedKeys, key])
				: new Set([...selectedKeys].filter((selectedKey) => selectedKey !== key))
		);
	}
</script>

<fieldset class="view-selection-list">
	<legend class="view-selection-legend">{legend}</legend>
	<div class="view-selection-header">
		<span aria-hidden="true">{legend}</span>
		{#if views.length > 0}
			<div class="view-selection-actions">
				<button type="button" onclick={() => onChange(new Set(views.map((view) => view.key)))}>
					Select all
				</button>
				<span aria-hidden="true">·</span>
				<button type="button" onclick={() => onChange(new Set())}>Select none</button>
			</div>
		{/if}
	</div>

	{#if views.length === 0}
		<p class="view-selection-empty">{emptyMessage}</p>
	{:else}
		<div class="view-selection-options">
			{#each views as view (view.key)}
				<label class="view-selection-option">
					<input
						type="checkbox"
						checked={selectedKeys.has(view.key)}
						onchange={(event) => setSelected(view.key, event.currentTarget.checked)}
					/>
					<span>{view.name}</span>
				</label>
			{/each}
		</div>
	{/if}
</fieldset>

<style>
	.view-selection-list {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.view-selection-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.view-selection-header > span {
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.view-selection-legend {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.view-selection-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		color: var(--text-caption);
		font-size: 0.75rem;
	}

	.view-selection-actions button {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
	}

	.view-selection-actions button:hover {
		text-decoration: underline;
	}

	.view-selection-actions button:focus-visible {
		border-radius: 0.25rem;
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.view-selection-options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		max-height: 10rem;
		overflow-y: auto;
		padding: 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		background: var(--bg-secondary);
	}

	.view-selection-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.25rem;
		border-radius: 0.375rem;
		color: var(--text-primary);
		font-size: 0.8125rem;
		line-height: 1.25;
		cursor: pointer;
	}

	.view-selection-option:hover {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.view-selection-option input {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		accent-color: var(--accent);
	}

	.view-selection-option span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.view-selection-empty {
		margin: 0;
		padding: 0.875rem;
		border: 1px dashed var(--border);
		border-radius: 0.625rem;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		text-align: center;
	}

	@media (max-width: 32rem) {
		.view-selection-options {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
