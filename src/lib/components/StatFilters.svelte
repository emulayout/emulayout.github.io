<script lang="ts">
	import StatLimitFiltersBody from '$lib/components/StatLimitFiltersBody.svelte';
	import { getStatFilterSectionSummary } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		getHandStatFilterFieldsForAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatLimitKey,
		type StatsAnalyzer
	} from '$lib/layoutStats';

	type StatCategory = 'bigram' | 'trigram' | 'other';

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

	const HANDS_ID = 'hands';

	/** Category → subgroup accordions per analyzer. */
	const ACCORDIONS: Record<StatsAnalyzer, Record<StatCategory, readonly StatAccordionDef[]>> = {
		[DEFAULT_STATS_ANALYZER]: {
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
			other: [{ id: 'effort', label: 'Effort', keys: ['totalWordEffort', 'effort'] }]
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

	let openById = $state<Record<string, boolean>>({});
	let focusKey = $state<StatLimitKey | null>(null);
	let focusToken = $state(0);
	let focusAnalyzer = $state<StatsAnalyzer | null>(null);
	let focusAccordionId = $state<string | null>(null);

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

	function categoryAccordions(
		analyzer: StatsAnalyzer,
		category: StatCategory
	): StatAccordionDef[] {
		return ACCORDIONS[analyzer][category].filter((entry) => visibleKeys(entry.keys).length > 0);
	}

	function analyzerIsActive(analyzer: StatsAnalyzer): boolean {
		return (
			Boolean(getStatFilterSectionSummary(filterStore, 'general', analyzer)) ||
			Boolean(getStatFilterSectionSummary(filterStore, 'hands', analyzer))
		);
	}

	function accordionIsActive(analyzer: StatsAnalyzer, keys: readonly StatLimitKey[]): boolean {
		return visibleKeys(keys).some(limitIsActive);
	}

	function handsIsActive(analyzer: StatsAnalyzer): boolean {
		return Boolean(getStatFilterSectionSummary(filterStore, 'hands', analyzer));
	}

	function accordionIdForKey(
		analyzer: StatsAnalyzer,
		key: StatLimitKey,
		section: 'general' | 'hands'
	): string {
		if (section === 'hands') return HANDS_ID;
		for (const category of CATEGORIES) {
			for (const entry of ACCORDIONS[analyzer][category.id]) {
				if (entry.keys.includes(key)) return entry.id;
			}
		}
		if (getHandStatFilterFieldsForAnalyzer(analyzer).some((field) => field.key === key)) {
			return HANDS_ID;
		}
		return ACCORDIONS[analyzer].other[0]?.id ?? HANDS_ID;
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

	function clearHands(analyzer: StatsAnalyzer) {
		filterStore.clearHandStatLimits(analyzer);
	}

	$effect(() => {
		const req = takeFilterFocusRequest('stats');
		if (!req) return;
		const analyzer = req.analyzer;
		const accordionId = accordionIdForKey(analyzer, req.key, req.section);
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

{#snippet generalAccordion(
	analyzer: StatsAnalyzer,
	analyzerLabel: string,
	entry: StatAccordionDef
)}
	{@const open = isOpen(analyzer, entry.id)}
	{@const keys = visibleKeys(entry.keys)}
	{@const active = accordionIsActive(analyzer, keys)}
	{@const panelId = `stat-filters-${analyzer}-${entry.id}-panel`}
	<div
		id="stat-filters-{analyzer}-{entry.id}-accordion"
		class="filter-accordion"
		class:filter-accordion--open={open}
		style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
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

<div class="stat-filters">
	{#each STAT_ANALYZERS as analyzerDef (analyzerDef.value)}
		{@const analyzer = analyzerDef.value}
		{@const analyzerActive = analyzerIsActive(analyzer)}
		{@const handsOpen = isOpen(analyzer, HANDS_ID)}
		{@const handsActive = handsIsActive(analyzer)}
		{@const handsPanelId = `stat-filters-${analyzer}-${HANDS_ID}-panel`}
		<section class="stat-analyzer-section" aria-label="{analyzerDef.label} stat filters">
			<div class="filter-section-header">
				<span class="filter-section-header-label">{analyzerDef.shortLabel}</span>
				{#if analyzerActive}
					<button
						type="button"
						class="filter-reset-button shrink-0"
						onclick={() => clearAnalyzer(analyzer)}
					>
						Reset all
					</button>
				{/if}
			</div>

			<div class="stat-analyzer-body">
				{#each CATEGORIES.slice(0, 2) as category (category.id)}
					{@const entries = categoryAccordions(analyzer, category.id)}
					{#if entries.length > 0}
						<div class="stat-category">
							<div class="stat-category-label">{category.label}</div>
							<div class="filter-accordion-group">
								{#each entries as entry (entry.id)}
									{@render generalAccordion(analyzer, analyzerDef.shortLabel, entry)}
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				<!-- Hands sits between Trigrams and Other; not broken up further. -->
				<div class="filter-accordion-group">
					<div
						id="stat-filters-{analyzer}-{HANDS_ID}-accordion"
						class="filter-accordion"
						class:filter-accordion--open={handsOpen}
						style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					>
						<div class="filter-accordion-header">
							<button
								type="button"
								class="filter-accordion-trigger"
								aria-expanded={handsOpen}
								aria-controls={handsPanelId}
								onclick={() => toggle(analyzer, HANDS_ID)}
							>
								<span class="sr-only">
									Hands &amp; fingers{#if handsActive}, active filters{/if}
								</span>
							</button>
							<div class="filter-accordion-header-face">
								<span class="filter-accordion-trigger-main">
									<svg
										class="filter-accordion-caret"
										class:filter-accordion-caret--expanded={handsOpen}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
										aria-hidden="true"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
									<span class="filter-accordion-trigger-label">
										Hands &amp; fingers
										{#if handsActive}
											<span class="filter-open-button-dot" aria-hidden="true"></span>
										{/if}
									</span>
								</span>
								<span class="filter-accordion-header-spacer" aria-hidden="true"></span>
								{#if handsActive}
									<div class="filter-accordion-header-actions">
										<button
											type="button"
											class="filter-reset-button shrink-0"
											onclick={() => clearHands(analyzer)}
										>
											Reset all
										</button>
									</div>
								{/if}
							</div>
						</div>

						{#if handsOpen}
							<div
								id={handsPanelId}
								class="filter-accordion-panel"
								role="region"
								aria-label="{analyzerDef.shortLabel} Hands & fingers"
							>
								<StatLimitFiltersBody section="hands" {analyzer} stacked />
							</div>
						{/if}
					</div>
				</div>

				{#each CATEGORIES.slice(2) as category (category.id)}
					{@const entries = categoryAccordions(analyzer, category.id)}
					{#if entries.length > 0}
						<div class="stat-category">
							<div class="stat-category-label">{category.label}</div>
							<div class="filter-accordion-group">
								{#each entries as entry (entry.id)}
									{@render generalAccordion(analyzer, analyzerDef.shortLabel, entry)}
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.stat-filters {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}

	.stat-analyzer-section {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stat-analyzer-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
