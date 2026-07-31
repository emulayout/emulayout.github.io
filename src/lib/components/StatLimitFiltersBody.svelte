<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { filterStore, type StatLimitOperator } from '$lib/filterStore.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';
	import {
		GENERAL_STAT_FILTER_COLUMN_COUNT,
		getGeneralStatFilterGroupsForAnalyzer,
		getHandUsageStatFilterFieldsForAnalyzer,
		getLeftFingerUsageStatFilterFieldsForAnalyzer,
		getRightFingerUsageStatFilterFieldsForAnalyzer,
		LIKES_STAT_FILTER_FIELD,
		type StatFilterField,
		type StatLimitKey
	} from '$lib/statsFiltering';
	import type { StatFilterSection } from '$lib/statsFiltering';
	import {
		FINGER_WORKLOAD_FINGERS,
		FINGER_WORKLOAD_HANDS,
		FINGER_WORKLOAD_PRESETS,
		fingerWorkloadHandPreferencesEqual,
		hasActiveFingerWorkloadHandPreference,
		hasConfiguredFingerWorkloadHandPreference,
		type FingerWorkloadFinger,
		type FingerWorkloadHand,
		type FingerWorkloadLevel,
		type FingerWorkloadPreset
	} from '$lib/fingerWorkload';

	interface Props {
		section: StatFilterSection | 'finger-workload';
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
	const generalStatFilterColumnIndices = [...Array(GENERAL_STAT_FILTER_COLUMN_COUNT).keys()];
	const workloadFingerLabels: Record<FingerWorkloadFinger, string> = {
		pinky: 'Pinky',
		ring: 'Ring',
		middle: 'Middle',
		index: 'Index'
	};
	const workloadHandLabels: Record<FingerWorkloadHand, string> = {
		left: 'Left hand',
		right: 'Right hand'
	};
	const workloadLevelBarHeights: Record<FingerWorkloadLevel, string> = {
		none: '0%',
		lightest: '25%',
		light: '45%',
		medium: '70%',
		heavy: '100%'
	};

	let workloadPresetOpen = $state(false);
	let workloadPresetRoot = $state<HTMLElement>();
	let workloadPresetTrigger = $state<HTMLButtonElement>();
	let workloadPresetMenuStyle = $state('');

	const generalStatFilterGroups = $derived(getGeneralStatFilterGroupsForAnalyzer(analyzer));
	const handUsageFields = $derived(getHandUsageStatFilterFieldsForAnalyzer(analyzer));
	const leftUsageFields = $derived.by(() => {
		const fields =
			section === 'hand-usage'
				? handUsageFields.slice(0, 1)
				: section === 'finger-usage'
					? getLeftFingerUsageStatFilterFieldsForAnalyzer(analyzer)
					: [];
		return fields.filter((field) => includeKey(field.key));
	});
	const rightUsageFields = $derived.by(() => {
		const fields =
			section === 'hand-usage'
				? handUsageFields.slice(1)
				: section === 'finger-usage'
					? getRightFingerUsageStatFilterFieldsForAnalyzer(analyzer)
					: [];
		return fields.filter((field) => includeKey(field.key));
	});
	/** Cyanophage uses long single-field rows; mana2/cmini keep related stats on one row. */
	const generalStacked = $derived(stacked || analyzer === CYANOPHAGE_ANALYZER);
	const showLikesFilter = $derived(
		filterStore.canUseLikes && includeKey(LIKES_STAT_FILTER_FIELD.key)
	);
	const workloadPreference = $derived(filterStore.fingerWorkload.preference);
	const workloadHandsLinked = $derived(filterStore.fingerWorkloadHandsAreLinked());
	const activeWorkloadPreset = $derived(
		FINGER_WORKLOAD_PRESETS.find((preset) =>
			fingerWorkloadHandPreferencesEqual(workloadPreference.left, preset.preference)
		)
	);
	const hasUsageLimits = $derived(leftUsageFields.length > 0 || rightUsageFields.length > 0);

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

	function groupFieldCount(group: { rows: readonly (readonly unknown[])[] }): number {
		return group.rows.reduce((count, row) => count + row.length, 0);
	}

	/** Section titles only when multiple groups exist and this group has >1 field. */
	function groupIsLabeled(group: { rows: readonly (readonly unknown[])[] }): boolean {
		return visibleGeneralGroups.length > 1 && groupFieldCount(group) > 1;
	}

	const hasLabeledGeneralGroups = $derived(visibleGeneralGroups.some(groupIsLabeled));

	function workloadPresetSummary(preset: FingerWorkloadPreset): string {
		return FINGER_WORKLOAD_FINGERS.map(
			(finger, index) =>
				`${index === 0 ? workloadFingerLabels[finger] : workloadFingerLabels[finger].toLowerCase()} ${preset.preference[finger]}`
		).join(' · ');
	}

	function applyWorkloadPreset(preset: FingerWorkloadPreset) {
		filterStore.setFingerWorkloadPreset(preset.preference);
		workloadPresetOpen = false;
		requestAnimationFrame(() => workloadPresetTrigger?.focus());
	}

	function positionWorkloadPresetMenu() {
		if (!workloadPresetTrigger) return;

		const triggerRect = workloadPresetTrigger.getBoundingClientRect();
		const viewportPadding = 12;
		const menuGap = 6;
		const menuWidth = Math.min(416, window.innerWidth - viewportPadding * 2);
		const menuLeft = Math.min(
			Math.max(triggerRect.left, viewportPadding),
			window.innerWidth - menuWidth - viewportPadding
		);
		const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding - menuGap;
		const spaceAbove = triggerRect.top - viewportPadding - menuGap;
		const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
		const maxHeight = Math.max(160, openAbove ? spaceAbove : spaceBelow);

		workloadPresetMenuStyle = openAbove
			? `left: ${menuLeft}px; top: auto; bottom: ${window.innerHeight - triggerRect.top + menuGap}px; width: ${menuWidth}px; max-height: ${maxHeight}px;`
			: `left: ${menuLeft}px; top: ${triggerRect.bottom + menuGap}px; bottom: auto; width: ${menuWidth}px; max-height: ${maxHeight}px;`;
	}

	function toggleWorkloadPresetMenu() {
		if (workloadPresetOpen) {
			workloadPresetOpen = false;
			return;
		}
		positionWorkloadPresetMenu();
		workloadPresetOpen = true;
	}

	function handleWorkloadPresetWindowClick(event: MouseEvent) {
		if (!workloadPresetOpen || !workloadPresetRoot) return;
		const target = event.target as Node | null;
		if (target && !workloadPresetRoot.contains(target)) workloadPresetOpen = false;
	}

	function handleWorkloadPresetWindowKeydown(event: KeyboardEvent) {
		if (!workloadPresetOpen || event.key !== 'Escape') return;
		event.preventDefault();
		workloadPresetOpen = false;
		requestAnimationFrame(() => workloadPresetTrigger?.focus());
	}

	function unlinkWorkloadHands() {
		workloadPresetOpen = false;
		filterStore.unlinkFingerWorkloadHands();
	}

	$effect(() => {
		if (!workloadPresetOpen) return;
		positionWorkloadPresetMenu();
		window.addEventListener('resize', positionWorkloadPresetMenu);
		window.addEventListener('scroll', positionWorkloadPresetMenu, true);
		return () => {
			window.removeEventListener('resize', positionWorkloadPresetMenu);
			window.removeEventListener('scroll', positionWorkloadPresetMenu, true);
		};
	});
</script>

<svelte:window
	onclick={handleWorkloadPresetWindowClick}
	onkeydown={handleWorkloadPresetWindowKeydown}
/>

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
			<span class="stat-limit-label" {title}>{displayLabel}:</span>
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

{#snippet usageLimitGrid()}
	<div class="stat-limits-hand-grid">
		{#if leftUsageFields.length > 0}
			<div class="stat-limits-group--labeled">
				<div class="stat-limits-hand-heading">Left hand</div>
				<div class="stat-limits-hand-list">
					{#each leftUsageFields as field (field.key)}
						{@render statLimitControl(field, '3.25rem')}
					{/each}
				</div>
			</div>
		{/if}
		{#if rightUsageFields.length > 0}
			<div class="stat-limits-group--labeled">
				<div class="stat-limits-hand-heading">Right hand</div>
				<div class="stat-limits-hand-list">
					{#each rightUsageFields as field (field.key)}
						{@render statLimitControl(field, '3.25rem')}
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet workloadPresetShape(preset: FingerWorkloadPreset)}
	<span class="finger-workload-preset-shape" aria-hidden="true">
		{#each FINGER_WORKLOAD_FINGERS as finger (finger)}
			<span class="finger-workload-preset-shape-column">
				<span class="finger-workload-preset-bar-track">
					<span
						class="finger-workload-preset-bar"
						style:height={workloadLevelBarHeights[preset.preference[finger]]}
					></span>
				</span>
				<span class="finger-workload-preset-letter">{workloadFingerLabels[finger][0]}</span>
			</span>
		{/each}
	</span>
{/snippet}

{#snippet workloadHandControls(hand: FingerWorkloadHand, label: string, linked = false)}
	{@const handPreference = workloadPreference[hand]}
	{@const handConfigured = hasConfiguredFingerWorkloadHandPreference(handPreference)}
	{@const handActive = hasActiveFingerWorkloadHandPreference(handPreference)}
	<div class="finger-workload-hand">
		<div class="finger-workload-hand-header">
			<div class="stat-limits-hand-heading">{label}</div>
		</div>
		{#if linked}
			<div bind:this={workloadPresetRoot} class="finger-workload-preset">
				<button
					bind:this={workloadPresetTrigger}
					type="button"
					class="finger-workload-preset-trigger"
					aria-haspopup="listbox"
					aria-expanded={workloadPresetOpen}
					aria-controls="finger-workload-presets-{analyzer}"
					onclick={toggleWorkloadPresetMenu}
				>
					{#if activeWorkloadPreset}
						{@render workloadPresetShape(activeWorkloadPreset)}
					{/if}
					<span class="finger-workload-preset-trigger-label">
						{activeWorkloadPreset?.label ?? 'Quick preset'}
					</span>
					<svg
						class="finger-workload-preset-caret"
						class:finger-workload-preset-caret--open={workloadPresetOpen}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{#if workloadPresetOpen}
					<div
						id="finger-workload-presets-{analyzer}"
						class="finger-workload-preset-menu"
						style={workloadPresetMenuStyle}
						role="listbox"
						aria-label="Quick finger workload presets"
					>
						{#each FINGER_WORKLOAD_PRESETS as preset (preset.id)}
							{@const selected = activeWorkloadPreset?.id === preset.id}
							<button
								type="button"
								class="finger-workload-preset-option"
								class:finger-workload-preset-option--selected={selected}
								role="option"
								aria-selected={selected}
								onclick={() => applyWorkloadPreset(preset)}
							>
								{@render workloadPresetShape(preset)}
								<span class="finger-workload-preset-option-copy">
									<span class="finger-workload-preset-option-label">{preset.label}</span>
									<span class="finger-workload-preset-option-summary">
										{workloadPresetSummary(preset)}
									</span>
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
		<div class="finger-workload-list">
			{#each FINGER_WORKLOAD_FINGERS as finger (finger)}
				<label class="finger-workload-control">
					<span>{workloadFingerLabels[finger]}</span>
					<select
						class="finger-workload-select"
						style={fieldStyle}
						value={handPreference[finger]}
						aria-label="{label} {workloadFingerLabels[finger]} workload preference"
						data-finger-workload-key="{hand}-{finger}"
						onchange={(event) =>
							filterStore.setFingerWorkloadPreference(
								hand,
								finger,
								event.currentTarget.value as FingerWorkloadLevel
							)}
					>
						<option value="none">No preference</option>
						<option value="lightest">Lightest</option>
						<option value="light">Light</option>
						<option value="medium">Medium</option>
						<option value="heavy">Heavy</option>
					</select>
				</label>
			{/each}
		</div>
		{#if handConfigured && !handActive}
			<p class="finger-workload-hint">
				Choose at least two different levels{linked ? '' : ' for this hand'}.
			</p>
		{/if}
	</div>
{/snippet}

<div
	class="stat-limits-body"
	class:stat-limits-body--stacked={stacked || (section === 'general' && generalStacked)}
>
	{#if section === 'general'}
		<section
			class="stat-limits-general"
			class:stat-limits-general--sectioned={hasLabeledGeneralGroups}
			aria-label="General stat filters"
		>
			{#each visibleGeneralGroups as group, groupIndex (group.title)}
				{@const labeled = groupIsLabeled(group)}
				<div class="stat-limits-group" class:stat-limits-group--labeled={labeled}>
					{#if labeled}
						<div class="stat-limits-group-heading">{group.title}</div>
					{/if}
					<div class="stat-limits-group-rows">
						{#each group.rows as row, rowIndex (`${groupIndex}-${rowIndex}`)}
							<div class="stat-limit-row">
								{#each generalStatFilterColumnIndices as colIndex (colIndex)}
									{@const field = row[colIndex]}
									{#if field}
										{@render statLimitControl(field, generalStacked ? '3.25rem' : '2.5rem', true)}
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
				{@const likesLabeled = visibleGeneralGroups.length > 0}
				<div class="stat-limits-group" class:stat-limits-group--labeled={likesLabeled}>
					{#if likesLabeled}
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
	{:else if section === 'finger-workload'}
		<section class="finger-workload" aria-label="Finger workload filters">
			<label class="finger-workload-analyzer">
				<span>Measure using</span>
				<select
					class="finger-workload-select"
					style={fieldStyle}
					value={filterStore.fingerWorkload.analyzer}
					aria-label="Measure finger workload using"
					onchange={(event) =>
						filterStore.setFingerWorkloadAnalyzer(event.currentTarget.value as StatsAnalyzer)}
				>
					{#each STAT_ANALYZERS as analyzerOption (analyzerOption.value)}
						<option value={analyzerOption.value}>{analyzerOption.shortLabel}</option>
					{/each}
				</select>
			</label>
			<div
				class="finger-workload-hand-grid"
				class:finger-workload-hand-grid--linked={workloadHandsLinked}
			>
				{#if workloadHandsLinked}
					{@render workloadHandControls('left', 'Both hands', true)}
				{:else}
					{#each FINGER_WORKLOAD_HANDS as hand (hand)}
						{@render workloadHandControls(hand, workloadHandLabels[hand])}
					{/each}
				{/if}
			</div>
			<div class="finger-workload-action-row">
				{#if workloadHandsLinked}
					<button type="button" class="finger-workload-action" onclick={unlinkWorkloadHands}>
						Unlink hands
					</button>
				{:else}
					<button
						type="button"
						class="finger-workload-action"
						onclick={() => filterStore.relinkFingerWorkloadHands()}
					>
						Relink hands
					</button>
				{/if}
			</div>
		</section>
	{:else if hasUsageLimits}
		<section
			class="stat-limits-hands"
			aria-label={section === 'hand-usage' ? 'Hand usage filters' : 'Finger usage filters'}
		>
			{@render usageLimitGrid()}
		</section>
	{/if}
</div>

<style>
	.stat-limits-body {
		--stat-cell-gap: 0.75rem;
		--stat-field-gap: 1.25rem;

		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		min-width: 0;
		padding-inline: 0.75rem;
		overflow: visible;
	}

	.stat-limits-general {
		container-type: inline-size;
		container-name: stat-limits-general;
		display: flex;
		flex-direction: column;
		gap: var(--stat-field-gap);
		width: 100%;
		min-width: 0;
		/* Keep focus rings inside the paint box of this section. */
		padding-block: 0.125rem;
		overflow: visible;
	}

	.stat-limits-general--sectioned {
		gap: 1.5rem;
	}

	.stat-limits-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	/* Nest controls under section labels (e.g. Roll / Roll total, Left/Right hand). */
	.stat-limits-group--labeled .stat-limits-group-rows,
	.stat-limits-group--labeled .stat-limits-hand-list {
		padding-inline-start: 1rem;
	}

	.stat-limits-group-heading {
		font-size: 0.75rem;
		line-height: 1rem;
		color: var(--text-caption);
	}

	.stat-limits-group-rows {
		display: flex;
		flex-direction: column;
		gap: var(--stat-field-gap);
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
		gap: var(--stat-field-gap);
	}

	.finger-workload {
		min-width: 0;
		padding-block: 0.125rem;
	}

	.finger-workload-analyzer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.875rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.finger-workload-analyzer .finger-workload-select {
		width: min(11rem, 58%);
	}

	.finger-workload-hand-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		min-width: 0;
	}

	.finger-workload-hand {
		min-width: 0;
	}

	.finger-workload-hand-grid--linked {
		grid-template-columns: minmax(0, 1fr);
	}

	.finger-workload-hand-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.finger-workload-hand-header .stat-limits-hand-heading {
		margin-bottom: 0;
	}

	.finger-workload-preset {
		position: relative;
		z-index: 2;
		margin-bottom: 0.75rem;
	}

	.finger-workload-preset-trigger {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		min-width: 0;
		min-height: 2.5rem;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.75rem;
		line-height: 1rem;
		text-align: left;
		cursor: pointer;
	}

	.finger-workload-preset-trigger:hover {
		border-color: var(--text-caption);
	}

	.finger-workload-preset-trigger:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.finger-workload-preset-trigger-label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.finger-workload-preset-caret {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: var(--text-caption);
		transition: transform 0.2s ease;
	}

	.finger-workload-preset-caret--open {
		transform: rotate(180deg);
	}

	.finger-workload-preset-menu {
		position: fixed;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		overflow-y: auto;
		padding: 0.375rem;
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		background: var(--bg-primary);
		box-shadow: 0 0.75rem 2rem color-mix(in srgb, #000 28%, transparent);
	}

	.finger-workload-preset-option {
		display: grid;
		grid-template-columns: 3.75rem minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-width: 0;
		padding: 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
	}

	.finger-workload-preset-option:hover,
	.finger-workload-preset-option:focus-visible {
		border-color: var(--border);
		background: var(--input-bg);
		outline: none;
	}

	.finger-workload-preset-option--selected {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
	}

	.finger-workload-preset-option-copy {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.finger-workload-preset-option-label {
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
	}

	.finger-workload-preset-option-summary {
		overflow: hidden;
		color: var(--text-caption);
		font-size: 0.6875rem;
		line-height: 1rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.finger-workload-preset-shape {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.1875rem;
		width: 3.25rem;
		height: 2rem;
		flex-shrink: 0;
	}

	.finger-workload-preset-shape-column {
		display: grid;
		grid-template-rows: minmax(0, 1fr) 0.625rem;
		gap: 0.0625rem;
		min-width: 0;
	}

	.finger-workload-preset-bar-track {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		min-height: 0;
		border-bottom: 1px solid var(--border);
	}

	.finger-workload-preset-bar {
		display: block;
		width: 100%;
		min-height: 0.125rem;
		border-radius: 0.125rem 0.125rem 0 0;
		background: color-mix(in srgb, var(--accent) 72%, var(--text-secondary));
	}

	.finger-workload-preset-letter {
		color: var(--text-caption);
		font-size: 0.5rem;
		line-height: 0.625rem;
		text-align: center;
	}

	.finger-workload-action-row {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		color: var(--text-caption);
		font-size: 0.75rem;
		line-height: 1.25rem;
	}

	.finger-workload-action {
		flex-shrink: 0;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
		cursor: pointer;
	}

	.finger-workload-action:hover {
		border-color: var(--text-caption);
	}

	.finger-workload-action:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.finger-workload-hint {
		margin: 0.75rem 0 0;
		font-size: 0.75rem;
		line-height: 1.25rem;
		color: var(--text-caption);
	}

	.finger-workload-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.finger-workload-control {
		display: grid;
		grid-template-columns: 4rem minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		color: var(--text-secondary);
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.finger-workload-select {
		width: 100%;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		line-height: 1rem;
		outline: none;
		cursor: pointer;
	}

	.finger-workload-select:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.stat-limits-body--stacked .stat-limit-row {
		grid-template-columns: 1fr;
		gap: var(--stat-field-gap);
	}

	.stat-limits-body--stacked .stat-limit-cell-empty {
		display: none;
	}

	.stat-limits-body--stacked .stat-limits-hand-grid {
		grid-template-columns: 1fr;
	}

	.stat-limits-body--stacked .finger-workload-hand-grid {
		grid-template-columns: 1fr;
	}

	/* sm and below: one field per row (same as former <sm layout). */
	@media (max-width: 767px) {
		.stat-limit-row {
			grid-template-columns: 1fr;
			gap: var(--stat-field-gap);
		}

		.stat-limit-cell-empty {
			display: none;
		}

		.stat-limits-hand-grid {
			grid-template-columns: 1fr;
		}

		.finger-workload-hand-grid {
			grid-template-columns: 1fr;
		}

		.finger-workload-action-row {
			align-items: stretch;
			flex-direction: column;
		}

		.finger-workload-action {
			width: 100%;
		}
	}

	/* Stack cells within a stat row when the general section is too narrow. */
	@container stat-limits-general (max-width: 26rem) {
		.stat-limit-row {
			grid-template-columns: 1fr;
			gap: var(--stat-field-gap);
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
