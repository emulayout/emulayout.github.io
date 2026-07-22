<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { filterStore, type StatLimitOperator } from '$lib/filterStore.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		GENERAL_STAT_FILTER_COLUMN_COUNT,
		getGeneralStatFilterGroupsForAnalyzer,
		getLeftHandStatFilterFieldsForAnalyzer,
		getRightHandStatFilterFieldsForAnalyzer,
		LIKES_STAT_FILTER_FIELD,
		type StatFilterField,
		type StatLimitKey,
		type StatsAnalyzer
	} from '$lib/layoutStats';
	import type { StatFilterSection } from '$lib/filterSummaries';

	interface Props {
		section: StatFilterSection;
		/** Which analyzer’s general filter fields to show. */
		analyzer?: StatsAnalyzer;
		/** Force a single column (e.g. narrow modal). */
		stacked?: boolean;
		/** When set, only render these limit keys (Adjust mode). */
		onlyKeys?: readonly StatLimitKey[] | null;
	}

	let {
		section,
		analyzer = DEFAULT_STATS_ANALYZER,
		stacked = false,
		onlyKeys = null
	}: Props = $props();

	function fieldTitle(field: StatFilterField): string {
		return field.title ?? field.label;
	}

	/** Full name with abbreviation, e.g. "Same Finger Bigrams (SFB)". */
	function fieldDisplayLabel(field: StatFilterField): string {
		const full = fieldTitle(field);
		if (full.toLowerCase() === field.label.toLowerCase()) return full;
		return `${full} (${field.label})`;
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

	function includeKey(key: StatLimitKey): boolean {
		return !onlyKeys || onlyKeys.includes(key);
	}

	const fieldStyle = `
		background-color: var(--input-bg);
		color: var(--text-primary);
		border: 1px solid var(--border);
		--tw-ring-color: var(--accent);
	`;

	const generalStatFilterGroups = $derived(getGeneralStatFilterGroupsForAnalyzer(analyzer));
	const leftHandFields = $derived(
		getLeftHandStatFilterFieldsForAnalyzer(analyzer).filter((field) => includeKey(field.key))
	);
	const rightHandFields = $derived(
		getRightHandStatFilterFieldsForAnalyzer(analyzer).filter((field) => includeKey(field.key))
	);
	/** Cyanophage uses long single-field rows; mana2/cmini keep related stats on one row. */
	const generalStacked = $derived(stacked || analyzer === CYANOPHAGE_ANALYZER);
	const showLikesFilter = $derived(
		filterStore.canUseLikes && includeKey(LIKES_STAT_FILTER_FIELD.key)
	);

	/** Keep titled groups when `onlyKeys` is set; drop empty rows/groups. */
	const visibleGeneralGroups = $derived.by(() => {
		return generalStatFilterGroups
			.map((group) => ({
				title: group.title,
				rows: group.rows
					.map((row) => row.filter((field) => includeKey(field.key)))
					.filter((row) => row.length > 0)
			}))
			.filter((group) => group.rows.length > 0);
	});
</script>

{#snippet statLimitControl(field: StatFilterField, labelWidth: string, expanded = false)}
	{@const limit = filterStore.statLimits[field.key]}
	{@const title = fieldTitle(field)}
	{@const displayLabel = expanded ? fieldDisplayLabel(field) : field.label}
	<div
		class="stat-limit-control"
		class:stat-limit-control--expanded={expanded}
		data-stat-limit-control={field.key}
	>
		<span class="stat-limit-label-row" style={expanded ? undefined : `width: ${labelWidth};`}>
			<span class="stat-limit-label" title={title}>{displayLabel}:</span>
			{#if field.hint}
				<Tooltip text={field.hint} />
			{/if}
		</span>
		<div class="stat-limit-inputs">
			<select
				value={limit.operator}
				onchange={(e) =>
					handleOperatorChange(field.key, e.currentTarget.value as StatLimitOperator)}
				class="stat-limit-operator"
				style={fieldStyle}
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
				style={fieldStyle}
				placeholder="—"
				aria-label="{title} limit"
				data-stat-limit-key={field.key}
			/>
			<span class="stat-limit-unit">{field.unit === 'raw' ? '' : '%'}</span>
		</div>
	</div>
{/snippet}

<div
	class="stat-limits-body"
	class:stat-limits-body--stacked={stacked || (section === 'general' && generalStacked)}
>
	{#if section === 'general'}
		<section class="stat-limits-general" aria-label="General stat filters">
			{#each visibleGeneralGroups as group, groupIndex (group.title)}
				<div class="stat-limits-group">
					{#if visibleGeneralGroups.length > 1}
						<div class="stat-limits-group-heading">{group.title}</div>
					{/if}
					<div class="stat-limits-group-rows">
						{#each group.rows as row, rowIndex (`${groupIndex}-${rowIndex}`)}
							<div class="stat-limit-row">
								{#each Array(GENERAL_STAT_FILTER_COLUMN_COUNT) as _, colIndex (colIndex)}
									{@const field = row[colIndex]}
									{#if field}
										{@render statLimitControl(
											field,
											generalStacked ? '3.25rem' : '2.5rem',
											true
										)}
									{:else if !generalStacked}
										<div class="stat-limit-cell-empty" aria-hidden="true"></div>
									{/if}
								{/each}
							</div>
						{/each}
					</div>
				</div>
			{/each}
			{#if showLikesFilter}
				<div class="stat-limits-group">
					{#if visibleGeneralGroups.length > 0}
						<div class="stat-limits-group-heading">Community</div>
					{/if}
					<div class="stat-limits-group-rows">
						<div class="stat-limit-row">
							<div>
								{@render statLimitControl(
									LIKES_STAT_FILTER_FIELD,
									generalStacked ? '3.25rem' : '2.5rem',
									true
								)}
							</div>
							{#if !generalStacked}
								<div class="stat-limit-cell-empty" aria-hidden="true"></div>
								<div class="stat-limit-cell-empty" aria-hidden="true"></div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</section>
	{:else if leftHandFields.length > 0 || rightHandFields.length > 0}
		<section class="stat-limits-hands" aria-label="Hand and finger stat filters">
			<div class="stat-limits-hand-grid">
				{#if leftHandFields.length > 0}
					<div>
						<div class="stat-limits-hand-heading">Left hand</div>
						<div class="stat-limits-hand-list">
							{#each leftHandFields as field (field.key)}
								{@render statLimitControl(field, '3.25rem')}
							{/each}
						</div>
					</div>
				{/if}
				{#if rightHandFields.length > 0}
					<div>
						<div class="stat-limits-hand-heading">Right hand</div>
						<div class="stat-limits-hand-list">
							{#each rightHandFields as field (field.key)}
								{@render statLimitControl(field, '3.25rem')}
							{/each}
						</div>
					</div>
				{/if}
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
		overflow: visible;
	}

	.stat-limits-general {
		container-type: inline-size;
		container-name: stat-limits-general;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		min-width: 0;
		/* Keep focus rings inside the paint box of this section. */
		padding-block: 0.125rem;
		overflow: visible;
	}

	.stat-limits-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}

	.stat-limits-group-heading {
		font-size: 0.75rem;
		line-height: 1rem;
		color: var(--text-caption);
	}

	.stat-limits-group-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
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

	.stat-limit-control--expanded {
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
	}

	.stat-limit-label-row {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		min-width: 0;
		justify-content: flex-end;
	}

	.stat-limit-control--expanded .stat-limit-label-row {
		width: auto;
		justify-content: flex-start;
	}

	.stat-limit-label {
		font-size: 0.75rem;
		line-height: 1rem;
		text-align: right;
		color: var(--text-secondary);
	}

	.stat-limit-control--expanded .stat-limit-label {
		text-align: left;
		line-height: 1.25;
	}

	.stat-limit-inputs {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex: 1;
		min-width: 0;
	}

	.stat-limit-control--expanded .stat-limit-inputs {
		width: 100%;
		flex: 1 1 auto;
	}

	.stat-limit-operator {
		flex: 1 1 0;
		min-width: 0;
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
		padding-block: 0.125rem;
		overflow: visible;
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
