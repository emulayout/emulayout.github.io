<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
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

	function fieldStyle(active: boolean): string {
		return `
			background-color: var(--bg-secondary);
			color: var(--text-primary);
			border: 1px solid ${active ? 'var(--accent)' : 'var(--border)'};
			--tw-ring-color: var(--accent);
		`;
	}

	function operatorSymbol(operator: StatLimitOperator): string {
		return operator === 'lt' ? '<' : '>';
	}

	function formatActiveLimit(field: StatFilterField, label: string): string | null {
		const limit = filterStore.statLimits[field.key];
		const value = limit.value.trim();
		if (!value) return null;
		const unit = field.unit === 'raw' ? '' : '%';
		return `${label} ${operatorSymbol(limit.operator)} ${value}${unit}`;
	}

	function handSummaryLabel(hand: 'LH' | 'RH', field: StatFilterField): string {
		if (field.key === 'lh' || field.key === 'rh') return hand;
		return `${hand} ${field.label}`;
	}

	let expanded = $state(filterStore.hasActiveStatLimits);

	const hasActiveFilters = $derived(filterStore.hasActiveStatLimits);
	const generalStatFilterRows = $derived(
		getGeneralStatFilterRowsForAnalyzer(filterStore.statsAnalyzer)
	);
	const showLikesFilter = $derived(filterStore.canUseLikes);

	const activeFilterSummary = $derived.by(() => {
		const parts: string[] = [];

		for (const row of generalStatFilterRows) {
			for (const field of row) {
				const part = formatActiveLimit(field, field.label);
				if (part) parts.push(part);
			}
		}

		if (showLikesFilter) {
			const part = formatActiveLimit(LIKES_STAT_FILTER_FIELD, LIKES_STAT_FILTER_FIELD.label);
			if (part) parts.push(part);
		}

		for (const field of LEFT_HAND_STAT_FILTER_FIELDS) {
			const part = formatActiveLimit(field, handSummaryLabel('LH', field));
			if (part) parts.push(part);
		}

		for (const field of RIGHT_HAND_STAT_FILTER_FIELDS) {
			const part = formatActiveLimit(field, handSummaryLabel('RH', field));
			if (part) parts.push(part);
		}

		return parts.join(' • ');
	});

	$effect(() => {
		if (hasActiveFilters) expanded = true;
	});
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
			class="stat-limit-value"
			style={fieldStyle(isActive(field.key))}
			placeholder="—"
			aria-label="{title} limit"
		/>
		<span class="stat-limit-unit">{field.unit === 'raw' ? '' : '%'}</span>
	</div>
{/snippet}

<div
	class="stat-filters-panel"
	class:stat-filters-panel--active={hasActiveFilters}
>
	<div class="stat-filters-header">
		<button
			type="button"
			class="stat-filters-toggle"
			aria-expanded={expanded}
			aria-controls="stat-filters-content"
			onclick={() => (expanded = !expanded)}
		>
			<svg
				class="stat-filters-chevron"
				class:stat-filters-chevron--expanded={expanded}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M9 18l6-6-6-6" />
			</svg>
			<span class="text-sm font-medium" style="color: var(--text-secondary);">Stat filters</span>
		</button>
		<div class="stat-filters-help">
			<Tooltip
				text="Filter layouts by stats. Leave a value empty to ignore that stat. Layouts without stats are hidden when any filter is set."
			/>
		</div>
		{#if !expanded && activeFilterSummary}
			<p class="stat-filters-summary" title={activeFilterSummary} style="color: var(--text-primary);">
				{activeFilterSummary}
			</p>
		{/if}
	</div>

	<div
		id="stat-filters-content"
		class="stat-filters-body"
		class:stat-filters-body--expanded={expanded}
		aria-hidden={!expanded}
		inert={!expanded}
	>
		<div class="stat-filters-body-inner">
			<div class="stat-limits-body">
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

				<section class="stat-limits-hands" aria-label="Hand and finger stat filters">
					<h3 class="stat-limits-hands-title">Hands &amp; fingers</h3>
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
			</div>
		</div>
	</div>
</div>

<style>
	.stat-filters-panel {
		--stat-cell-gap: 0.75rem;

		padding: 1rem;
		border-radius: 0.75rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border);
	}

	.stat-filters-panel--active {
		border-color: var(--accent);
	}

	.stat-filters-header {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		min-width: 0;
	}

	.stat-filters-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		outline: none;
		border-radius: 0.375rem;
		flex-shrink: 0;
	}

	.stat-filters-toggle:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.stat-filters-chevron {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--text-secondary);
		transition: transform 0.2s ease;
	}

	.stat-filters-chevron--expanded {
		transform: rotate(90deg);
	}

	.stat-filters-summary {
		flex: 1 1 0;
		min-width: 0;
		margin: 0;
		font-size: 0.75rem;
		line-height: 1rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stat-filters-help {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.stat-filters-body {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.2s ease;
	}

	.stat-filters-body--expanded {
		grid-template-rows: 1fr;
	}

	.stat-filters-body-inner {
		overflow: hidden;
		min-height: 0;
	}

	.stat-filters-body--expanded .stat-filters-body-inner {
		padding-top: 0.75rem;
	}

	.stat-limits-body {
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
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.stat-limits-hands-title {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
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

	/* Smallest screens: one field per row everywhere. */
	@media (max-width: 639px) {
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

	/* Wide enough for general + hands side by side. */
	@media (min-width: 1280px) {
		.stat-limits-body {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}

		.stat-limits-hands {
			padding-top: 0;
			padding-left: 1.5rem;
			border-top: none;
			border-left: 1px solid var(--border);
		}
	}
</style>
