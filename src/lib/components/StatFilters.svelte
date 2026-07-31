<script lang="ts">
	import AnalyzerTabs from '$lib/components/AnalyzerTabs.svelte';
	import StatLimitFiltersBody from '$lib/components/StatLimitFiltersBody.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';
	import {
		CMINI_ANALYZER,
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		isStatsAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';
	import {
		getFingerUsageStatFilterFieldsForAnalyzer,
		getHandUsageStatFilterFieldsForAnalyzer,
		hasActiveStatFilterSection,
		type StatFilterSection,
		type StatLimitKey
	} from '$lib/statsFiltering';

	type StatCategory = 'bigram' | 'trigram' | 'other';
	type UsageStatFilterSection = Exclude<StatFilterSection, 'general'>;

	interface StatAccordionDef {
		id: string;
		label: string;
		keys: readonly StatLimitKey[];
	}

	const CATEGORIES: Array<{ id: StatCategory; label: string }> = [
		{ id: 'bigram', label: 'Bigrams' },
		{ id: 'trigram', label: 'Trigrams' },
		{ id: 'other', label: 'Other' }
	];

	const HAND_USAGE_ID = 'hand-usage';
	const FINGER_USAGE_ID = 'finger-usage';

	/** Category → subgroup accordions per analyzer. */
	const ACCORDIONS: Record<StatsAnalyzer, Record<StatCategory, readonly StatAccordionDef[]>> = {
		[CMINI_ANALYZER]: {
			bigram: [{ id: 'same-finger', label: 'Same finger', keys: ['sfb'] }],
			trigram: [
				{ id: 'alternation', label: 'Alternation', keys: ['alternate'] },
				{
					id: 'rolls',
					label: 'Rolls',
					keys: ['roll', 'rollIn', 'rollOut', 'rtl', 'rtlIn', 'rtlOut']
				},
				{ id: 'one-hand', label: 'One-hand', keys: ['one', 'oneIn', 'oneOut'] },
				{ id: 'redirect', label: 'Redirect', keys: ['red', 'badRedirect'] },
				{
					id: 'same-finger-skips',
					label: 'Same-finger skips',
					keys: ['sfs', 'dsfbRed', 'dsfbAlt']
				}
			],
			other: [{ id: 'community', label: 'Community', keys: ['likes'] }]
		},
		[CYANOPHAGE_ANALYZER]: {
			bigram: [
				{
					id: 'finger-patterns',
					label: 'Finger patterns',
					keys: ['cyano-sfb', 'cyano-sfs', 'lsb', 'scissors']
				}
			],
			trigram: [],
			other: [
				{
					id: 'effort',
					label: 'Effort',
					keys: ['totalWordEffort', 'effort', 'cyano-distance']
				}
			]
		},
		[MANA2_ANALYZER]: {
			bigram: [
				{ id: 'same-finger', label: 'Same finger', keys: ['mana-sfb'] },
				{ id: 'same-key', label: 'Same key', keys: ['skb'] },
				{ id: 'stretch', label: 'Stretch', keys: ['mana-lsb'] },
				{ id: 'scissor', label: 'Scissor', keys: ['mana-vsb'] }
			],
			trigram: [
				{
					id: 'skipgrams',
					label: 'Skipgrams',
					keys: ['mana-sfs', 'sks', 'mana-lss', 'mana-vss']
				},
				{
					id: 'alternation',
					label: 'Alternation',
					keys: ['mana-alt', 'altNoThumbs', 'altSfs']
				},
				{
					id: 'redirect',
					label: 'Redirect',
					keys: [
						'mana-redirect',
						'redirectNoThumbs',
						'redirectWeak',
						'redirectSfs',
						'redirectSfsWeak'
					]
				},
				{
					id: 'rolls',
					label: 'Rolls',
					keys: [
						'mana-roll',
						'inroll2',
						'outroll2',
						'rollNoThumbs',
						'inroll3',
						'outroll3',
						'goodroll'
					]
				}
			],
			other: [{ id: 'offpinky', label: 'Off pinky', keys: ['offpinky'] }]
		}
	};

	function initialAnalyzer(): StatsAnalyzer {
		return isStatsAnalyzer(filterStore.statsAnalyzer)
			? filterStore.statsAnalyzer
			: DEFAULT_STATS_ANALYZER;
	}

	let selectedAnalyzer = $state<StatsAnalyzer>(initialAnalyzer());
	let openById = $state<Record<string, boolean>>({});
	let focusKey = $state<StatLimitKey | null>(null);
	let focusToken = $state(0);
	let focusAnalyzer = $state<StatsAnalyzer | null>(null);
	let focusAccordionId = $state<string | null>(null);

	const selectedAnalyzerDef = $derived(
		STAT_ANALYZERS.find((entry) => entry.value === selectedAnalyzer) ?? STAT_ANALYZERS[0]
	);

	function accordionDomId(analyzer: StatsAnalyzer, id: string): string {
		return `${analyzer}:${id}`;
	}

	function isOpen(analyzer: StatsAnalyzer, id: string): boolean {
		return Boolean(openById[accordionDomId(analyzer, id)]);
	}

	function limitIsActive(key: StatLimitKey): boolean {
		return filterStore.statLimits[key]?.value.trim() !== '';
	}

	function visibleKeys(keys: readonly StatLimitKey[]): readonly StatLimitKey[] {
		return keys.filter((key) => key !== 'likes' || filterStore.canUseLikes);
	}

	function categoryAccordions(analyzer: StatsAnalyzer, category: StatCategory): StatAccordionDef[] {
		return ACCORDIONS[analyzer][category].filter((entry) => visibleKeys(entry.keys).length > 0);
	}

	function analyzerIsActive(analyzer: StatsAnalyzer): boolean {
		return (
			hasActiveStatFilterSection(filterStore.statLimits, analyzer, 'general', {
				includeLikes: filterStore.canUseLikes
			}) ||
			hasActiveStatFilterSection(filterStore.statLimits, analyzer, 'hand-usage') ||
			hasActiveStatFilterSection(filterStore.statLimits, analyzer, 'finger-usage')
		);
	}

	function accordionIsActive(analyzer: StatsAnalyzer, keys: readonly StatLimitKey[]): boolean {
		return visibleKeys(keys).some(limitIsActive);
	}

	function usageKeys(
		analyzer: StatsAnalyzer,
		section: UsageStatFilterSection
	): readonly StatLimitKey[] {
		return section === 'hand-usage'
			? getHandUsageStatFilterFieldsForAnalyzer(analyzer).map((field) => field.key)
			: getFingerUsageStatFilterFieldsForAnalyzer(analyzer).map((field) => field.key);
	}

	function accordionIdForKey(
		analyzer: StatsAnalyzer,
		key: StatLimitKey,
		section: StatFilterSection
	): string {
		if (section !== 'general') return section;
		for (const category of CATEGORIES) {
			for (const entry of ACCORDIONS[analyzer][category.id]) {
				if (entry.keys.includes(key)) return entry.id;
			}
		}
		if (getHandUsageStatFilterFieldsForAnalyzer(analyzer).some((field) => field.key === key)) {
			return HAND_USAGE_ID;
		}
		if (getFingerUsageStatFilterFieldsForAnalyzer(analyzer).some((field) => field.key === key)) {
			return FINGER_USAGE_ID;
		}
		return ACCORDIONS[analyzer].other[0]?.id ?? HAND_USAGE_ID;
	}

	function toggle(analyzer: StatsAnalyzer, id: string) {
		const key = accordionDomId(analyzer, id);
		const next = !openById[key];
		openById[key] = next;
		if (!next && focusAnalyzer === analyzer && focusAccordionId === id) {
			focusKey = null;
			focusAnalyzer = null;
			focusAccordionId = null;
		}
	}

	function clearAnalyzer(analyzer: StatsAnalyzer) {
		filterStore.clearGeneralStatLimits(analyzer);
		filterStore.clearHandStatLimits(analyzer);
	}

	function clearAccordion(analyzer: StatsAnalyzer, keys: readonly StatLimitKey[]) {
		for (const key of visibleKeys(keys)) {
			filterStore.clearStatLimit(key);
		}
	}

	$effect(() => {
		const req = takeFilterFocusRequest('stats');
		if (!req) return;
		const analyzer = req.analyzer;
		const accordionId = accordionIdForKey(analyzer, req.key, req.section);
		selectedAnalyzer = analyzer;
		openById[accordionDomId(analyzer, accordionId)] = true;
		focusAnalyzer = analyzer;
		focusAccordionId = accordionId;
		focusKey = req.key;
		focusToken = req.seq;
		afterPaint(() => {
			document
				.getElementById(`stat-filters-${analyzer}-${accordionId}-accordion`)
				?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});

	$effect(() => {
		if (!focusAnalyzer || !focusAccordionId || !focusKey || !focusToken) return;
		if (selectedAnalyzer !== focusAnalyzer) return;
		if (!isOpen(focusAnalyzer, focusAccordionId)) return;
		const analyzer = focusAnalyzer;
		const accordionId = focusAccordionId;
		const key = focusKey;
		afterPaint(() => {
			focusFilterControl(
				document.querySelector<HTMLElement>(
					`#stat-filters-${analyzer}-${accordionId}-panel [data-stat-limit-key="${key}"]`
				)
			);
		});
	});
</script>

{#snippet generalAccordion(analyzer: StatsAnalyzer, analyzerLabel: string, entry: StatAccordionDef)}
	{@const open = isOpen(analyzer, entry.id)}
	{@const keys = visibleKeys(entry.keys)}
	{@const active = accordionIsActive(analyzer, keys)}
	{@const panelId = `stat-filters-${analyzer}-${entry.id}-panel`}
	<div
		id="stat-filters-{analyzer}-{entry.id}-accordion"
		class="filter-accordion"
		class:filter-accordion--open={open}
		style="background-color: var(--bg-primary); border: 1px solid var(--border);"
	>
		<div class="filter-accordion-header">
			<button
				type="button"
				class="filter-accordion-trigger"
				aria-expanded={open}
				aria-controls={panelId}
				onclick={() => toggle(analyzer, entry.id)}
			>
				<span class="sr-only">
					{entry.label}{#if active}, active filters{/if}
				</span>
			</button>
			<div class="filter-accordion-header-face">
				<span class="filter-accordion-trigger-main">
					<svg
						class="filter-accordion-caret"
						class:filter-accordion-caret--expanded={open}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
					<span class="filter-accordion-trigger-label">
						{entry.label}
						{#if active}
							<span class="filter-open-button-dot" aria-hidden="true"></span>
						{/if}
					</span>
				</span>
				<span class="filter-accordion-header-spacer" aria-hidden="true"></span>
				{#if active}
					<div class="filter-accordion-header-actions">
						<button
							type="button"
							class="filter-reset-button shrink-0"
							onclick={() => clearAccordion(analyzer, keys)}
						>
							Reset all
						</button>
					</div>
				{/if}
			</div>
		</div>

		{#if open}
			<div
				id={panelId}
				class="filter-accordion-panel"
				role="region"
				aria-label="{analyzerLabel} {entry.label}"
			>
				<StatLimitFiltersBody section="general" {analyzer} onlyKeys={keys} stacked />
			</div>
		{/if}
	</div>
{/snippet}

{#snippet usageAccordion(
	analyzer: StatsAnalyzer,
	analyzerLabel: string,
	section: UsageStatFilterSection,
	label: string
)}
	{@const keys = usageKeys(analyzer, section)}
	{@const open = isOpen(analyzer, section)}
	{@const active = accordionIsActive(analyzer, keys)}
	{@const panelId = `stat-filters-${analyzer}-${section}-panel`}
	<div
		id="stat-filters-{analyzer}-{section}-accordion"
		class="filter-accordion"
		class:filter-accordion--open={open}
		style="background-color: var(--bg-primary); border: 1px solid var(--border);"
	>
		<div class="filter-accordion-header">
			<button
				type="button"
				class="filter-accordion-trigger"
				aria-expanded={open}
				aria-controls={panelId}
				onclick={() => toggle(analyzer, section)}
			>
				<span class="sr-only"
					>{label}{#if active}, active filters{/if}</span
				>
			</button>
			<div class="filter-accordion-header-face">
				<span class="filter-accordion-trigger-main">
					<svg
						class="filter-accordion-caret"
						class:filter-accordion-caret--expanded={open}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
					<span class="filter-accordion-trigger-label">
						{label}
						{#if active}
							<span class="filter-open-button-dot" aria-hidden="true"></span>
						{/if}
					</span>
				</span>
				<span class="filter-accordion-header-spacer" aria-hidden="true"></span>
				{#if active}
					<div class="filter-accordion-header-actions">
						<button
							type="button"
							class="filter-reset-button shrink-0"
							onclick={() => clearAccordion(analyzer, keys)}
						>
							Reset all
						</button>
					</div>
				{/if}
			</div>
		</div>

		{#if open}
			<div
				id={panelId}
				class="filter-accordion-panel"
				role="region"
				aria-label="{analyzerLabel} {label}"
			>
				<StatLimitFiltersBody {section} {analyzer} onlyKeys={keys} stacked />
			</div>
		{/if}
	</div>
{/snippet}

{#snippet analyzerPanel(analyzer: StatsAnalyzer, analyzerLabel: string)}
	{@const analyzerActive = analyzerIsActive(analyzer)}
	<div class="stat-analyzer-panel">
		{#if analyzerActive}
			<div class="stat-analyzer-panel-toolbar">
				<button
					type="button"
					class="filter-reset-button shrink-0"
					onclick={() => clearAnalyzer(analyzer)}
				>
					Reset all
				</button>
			</div>
		{/if}

		<div class="stat-analyzer-body">
			{#each CATEGORIES.slice(0, 2) as category (category.id)}
				{@const entries = categoryAccordions(analyzer, category.id)}
				{#if entries.length > 0}
					<div class="stat-category">
						<div class="stat-category-label">{category.label}</div>
						<div class="filter-accordion-group">
							{#each entries as entry (entry.id)}
								{@render generalAccordion(analyzer, analyzerLabel, entry)}
							{/each}
						</div>
					</div>
				{/if}
			{/each}

			<div class="filter-accordion-group">
				{@render usageAccordion(analyzer, analyzerLabel, HAND_USAGE_ID, 'Hand usage')}
				{@render usageAccordion(analyzer, analyzerLabel, FINGER_USAGE_ID, 'Finger usage')}
			</div>

			{#each CATEGORIES.slice(2) as category (category.id)}
				{@const entries = categoryAccordions(analyzer, category.id)}
				{#if entries.length > 0}
					<div class="stat-category">
						<div class="stat-category-label">{category.label}</div>
						<div class="filter-accordion-group">
							{#each entries as entry (entry.id)}
								{@render generalAccordion(analyzer, analyzerLabel, entry)}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

<div
	class="stat-filters"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="filter-section-header">
		<span class="filter-section-header-label">Analyzer filters</span>
	</div>
	<AnalyzerTabs
		variant="filters"
		ariaLabel="Analyzer filters"
		value={selectedAnalyzer}
		onChange={(next) => (selectedAnalyzer = next)}
		isActive={analyzerIsActive}
		idPrefix="stat-filters-tab"
		controls="stat-filters-tabpanel"
	/>

	<div
		id="stat-filters-tabpanel"
		role="region"
		aria-labelledby="stat-filters-tab-{selectedAnalyzer}"
	>
		{@render analyzerPanel(selectedAnalyzer, selectedAnalyzerDef.shortLabel)}
	</div>
</div>

<style>
	.stat-filters {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		padding: 0.75rem;
		border-radius: 0.75rem;
		box-sizing: border-box;
	}

	.stat-filters > :global(.filter-section-header) {
		margin-bottom: 0;
	}

	.stat-analyzer-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.stat-analyzer-panel-toolbar {
		display: flex;
		justify-content: flex-end;
	}

	.stat-analyzer-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.stat-category {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}

	.stat-category-label {
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
		color: var(--text-caption);
		padding-inline: 0.125rem;
	}
</style>
