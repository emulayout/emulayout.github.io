<script lang="ts">
	import { filterStore, type StatLimitOperator } from '$lib/filterStore.svelte';
	import {
		GENERAL_STAT_FILTER_COLUMN_COUNT,
		getGeneralStatFilterRowsForAnalyzer,
		LIKES_STAT_FILTER_FIELD,
		LEFT_HAND_STAT_FILTER_FIELDS,
		RIGHT_HAND_STAT_FILTER_FIELDS,
		type StatFilterField,
		type StatLimitKey
	} from '$lib/layoutStats';
	import type { StatFilterSection } from '$lib/filterSummaries';

	interface Props {
		section: StatFilterSection;
		/** Force a single column (e.g. narrow modal). */
		stacked?: boolean;
	}

	let { section, stacked = false }: Props = $props();

	function fieldTitle(field: StatFilterField): string {
		return field.title ?? field.label;
	}

	function isActive(key: StatLimitKey): boolean {
		return filterStore.statLimits[key].value.trim() !== '';
	}

	function handleOperatorChange(key: StatLimitKey, operator: StatLimitOperator) {
		filterStore.setStatLimitOperator(key, operator);
	}

	function handleValueInput(key: StatLimitKey, value: string) {
		filterStore.setStatLimitValue(key, value);
	}

	function handleValueKeyDown(key: StatLimitKey, event: KeyboardEvent) {
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			filterStore.nudgeStatLimitValue(key, 0.1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			filterStore.nudgeStatLimitValue(key, -0.1);
		}
	}

	function fieldStyle(active: boolean): string {
		return `
			background-color: var(--input-bg);
			color: var(--text-primary);
			border: 1px solid ${active ? 'var(--accent)' : 'var(--border)'};
			--tw-ring-color: var(--accent);
		`;
	}

	const generalStatFilterRows = $derived(
		getGeneralStatFilterRowsForAnalyzer(filterStore.statsAnalyzer)
	);
	const showLikesFilter = $derived(filterStore.canUseLikes);
</script>

{#snippet statLimitControl(field: StatFilterField, labelWidth: string)}
	{@const limit = filterStore.statLimits[field.key]}
	{@const title = fieldTitle(field)}
	<div class="stat-limit-control">
		<span class="stat-limit-label" style="width: {labelWidth};" title={title}>{field.label}:</span>
		<select
			value={limit.operator}
			onchange={(e) =>
				handleOperatorChange(field.key, e.currentTarget.value as StatLimitOperator)}
			class="stat-limit-operator"
			style={fieldStyle(isActive(field.key))}
			aria-label="{title} comparison"
		>
			<option value="lt">Less than</option>
			<option value="gt">Greater than</option>
		</select>
		<input
			type="text"
			inputmode="decimal"
			value={limit.value}
			oninput={(e) => handleValueInput(field.key, e.currentTarget.value)}
			onkeydown={(e) => handleValueKeyDown(field.key, e)}
			class="stat-limit-value"
			style={fieldStyle(isActive(field.key))}
			placeholder="—"
			aria-label="{title} limit"
		/>
		<span class="stat-limit-unit">{field.unit === 'raw' ? '' : '%'}</span>
	</div>
{/snippet}

<div class="stat-limits-body" class:stat-limits-body--stacked={stacked}>
	{#if section === 'general'}
		<section class="stat-limits-general" aria-label="General stat filters">
			{#each generalStatFilterRows as row, rowIndex (rowIndex)}
				<div class="stat-limit-row">
					{#each Array(GENERAL_STAT_FILTER_COLUMN_COUNT) as _, colIndex (colIndex)}
						{@const field = row[colIndex]}
						{#if field}
							{@render statLimitControl(field, '2.5rem')}
						{:else}
							<div class="stat-limit-cell-empty" aria-hidden="true"></div>
						{/if}
					{/each}
				</div>
			{/each}
			{#if showLikesFilter}
				<div class="stat-limit-row">
					<div>
						{@render statLimitControl(LIKES_STAT_FILTER_FIELD, '2.5rem')}
					</div>
					<div class="stat-limit-cell-empty" aria-hidden="true"></div>
					<div class="stat-limit-cell-empty" aria-hidden="true"></div>
				</div>
			{/if}
		</section>
	{:else}
		<section class="stat-limits-hands" aria-label="Hand and finger stat filters">
			<div class="stat-limits-hand-grid">
				<div>
					<div class="stat-limits-hand-heading">Left hand</div>
					<div class="stat-limits-hand-list">
						{#each LEFT_HAND_STAT_FILTER_FIELDS as field (field.key)}
							{@render statLimitControl(field, '3.25rem')}
						{/each}
					</div>
				</div>
				<div>
					<div class="stat-limits-hand-heading">Right hand</div>
					<div class="stat-limits-hand-list">
						{#each RIGHT_HAND_STAT_FILTER_FIELDS as field (field.key)}
							{@render statLimitControl(field, '3.25rem')}
						{/each}
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.stat-limits-body {
		--stat-cell-gap: 0.75rem;

		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		min-width: 0;
	}

	.stat-limits-general {
		container-type: inline-size;
		container-name: stat-limits-general;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		padding-bottom: 0.125rem;
	}

	.stat-limit-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--stat-cell-gap);
		min-width: 0;
		align-items: start;
	}

	.stat-limit-cell-empty {
		min-height: 1px;
	}

	.stat-limit-control {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
	}

	.stat-limit-label {
		flex-shrink: 0;
		font-size: 0.75rem;
		line-height: 1rem;
		text-align: right;
		color: var(--text-secondary);
	}

	.stat-limit-operator {
		flex: 1 1 0;
		min-width: 0;
		max-width: 5.5rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		line-height: 1rem;
		outline: none;
		cursor: pointer;
	}

	.stat-limit-operator:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.stat-limit-value {
		flex-shrink: 0;
		width: 2.75rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		line-height: 1rem;
		text-align: right;
		outline: none;
	}

	.stat-limit-value:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.stat-limit-unit {
		flex-shrink: 0;
		font-size: 0.75rem;
		line-height: 1rem;
		color: var(--text-caption);
	}

	.stat-limits-hands {
		container-type: inline-size;
		container-name: stat-limits-hands;
		width: 100%;
		min-width: 0;
	}

	.stat-limits-hand-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		min-width: 0;
	}

	.stat-limits-hand-heading {
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-caption);
	}

	.stat-limits-hand-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stat-limits-body--stacked .stat-limit-row {
		grid-template-columns: 1fr;
	}

	.stat-limits-body--stacked .stat-limit-cell-empty {
		display: none;
	}

	.stat-limits-body--stacked .stat-limits-hand-grid {
		grid-template-columns: 1fr;
	}

	/* sm and below: one field per row (same as former <sm layout). */
	@media (max-width: 767px) {
		.stat-limit-row {
			grid-template-columns: 1fr;
		}

		.stat-limit-cell-empty {
			display: none;
		}

		.stat-limits-hand-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Stack cells within a stat row when the general section is too narrow. */
	@container stat-limits-general (max-width: 26rem) {
		.stat-limit-row {
			grid-template-columns: 1fr;
		}

		.stat-limit-cell-empty {
			display: none;
		}
	}

	/* Stack left/right hand columns when the hands section is too narrow. */
	@container stat-limits-hands (max-width: 26rem) {
		.stat-limits-hand-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
