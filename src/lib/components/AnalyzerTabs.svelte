<script lang="ts">
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';

	interface Props {
		value: StatsAnalyzer;
		onChange: (value: StatsAnalyzer) => void;
		/** Accessible name for the control group. */
		ariaLabel?: string;
		variant?: 'filters' | 'toolbar';
		/** When set, shows an active-filter dot on that analyzer (filters variant). */
		isActive?: (analyzer: StatsAnalyzer) => boolean;
		/** Prefix for tab button ids (`{idPrefix}-{analyzer}`). */
		idPrefix?: string;
		/** Optional `aria-controls` target for each tab. */
		controls?: string;
		class?: string;
	}

	let {
		value,
		onChange,
		ariaLabel = 'Analyzer',
		variant = 'toolbar',
		isActive,
		idPrefix,
		controls,
		class: className = ''
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | undefined>(undefined);

	function selectAt(index: number) {
		const next = STAT_ANALYZERS[index];
		if (!next) return;
		onChange(next.value);
		const buttons = rootEl?.querySelectorAll<HTMLButtonElement>('[data-analyzer-tab]');
		buttons?.[index]?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		const count = STAT_ANALYZERS.length;
		let nextIndex = index;

		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				nextIndex = (index + 1) % count;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				nextIndex = (index - 1 + count) % count;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = count - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		selectAt(nextIndex);
	}
</script>

<div
	bind:this={rootEl}
	class="analyzer-tabs analyzer-tabs--{variant} {className}"
	style="background-color: var(--bg-primary); border: 1px solid var(--border);"
	role="toolbar"
	aria-label={ariaLabel}
	aria-orientation="horizontal"
>
	{#each STAT_ANALYZERS as analyzerDef, index (analyzerDef.value)}
		{@const selected = value === analyzerDef.value}
		{@const active = isActive?.(analyzerDef.value) ?? false}
		<button
			type="button"
			data-analyzer-tab
			id={idPrefix ? `${idPrefix}-${analyzerDef.value}` : undefined}
			aria-pressed={selected}
			aria-controls={controls}
			tabindex="0"
			class="analyzer-tab"
			class:analyzer-tab--selected={selected}
			class:analyzer-tab--cmini={analyzerDef.value === DEFAULT_STATS_ANALYZER}
			class:analyzer-tab--cyanophage={analyzerDef.value === CYANOPHAGE_ANALYZER}
			class:analyzer-tab--mana2={analyzerDef.value === MANA2_ANALYZER}
			onclick={() => onChange(analyzerDef.value)}
			onkeydown={(event) => handleKeydown(event, index)}
		>
			<span>{analyzerDef.shortLabel}</span>
			{#if variant === 'filters' && active}
				<span class="analyzer-tab-dot" aria-hidden="true"></span>
				<span class="analyzer-tab-sr">Has active filters</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.analyzer-tabs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		flex-shrink: 0;
	}

	.analyzer-tabs--filters {
		gap: 0.25rem;
		padding: 0.25rem;
		border-radius: 0.5rem;
	}

	.analyzer-tabs--toolbar {
		display: inline-grid;
		gap: 0.125rem;
		padding: 0.125rem;
		border-radius: 0.375rem;
	}

	.analyzer-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-width: 0;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.analyzer-tabs--filters .analyzer-tab {
		padding: 0.4375rem 0.375rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		line-height: 1.25;
	}

	.analyzer-tabs--toolbar .analyzer-tab {
		min-width: 3.5rem;
		padding: 0.125rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1.2;
	}

	.analyzer-tab:hover {
		color: var(--text-primary);
	}

	.analyzer-tab:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.analyzer-tabs--filters .analyzer-tab--selected {
		background-color: var(--bg-secondary);
		border-color: var(--border);
		color: var(--text-primary);
		font-weight: 600;
	}

	.analyzer-tabs--filters .analyzer-tab--cmini.analyzer-tab--selected {
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		box-shadow: inset 0 -2px 0 var(--analyzer-cmini);
	}

	.analyzer-tabs--filters .analyzer-tab--cyanophage.analyzer-tab--selected {
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		box-shadow: inset 0 -2px 0 var(--analyzer-cyanophage);
	}

	.analyzer-tabs--filters .analyzer-tab--mana2.analyzer-tab--selected {
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		box-shadow: inset 0 -2px 0 var(--analyzer-mana2);
	}

	.analyzer-tabs--filters .analyzer-tab--cmini.analyzer-tab--selected:focus-visible {
		box-shadow:
			inset 0 -2px 0 var(--analyzer-cmini),
			0 0 0 2px var(--accent);
	}

	.analyzer-tabs--filters .analyzer-tab--cyanophage.analyzer-tab--selected:focus-visible {
		box-shadow:
			inset 0 -2px 0 var(--analyzer-cyanophage),
			0 0 0 2px var(--accent);
	}

	.analyzer-tabs--filters .analyzer-tab--mana2.analyzer-tab--selected:focus-visible {
		box-shadow:
			inset 0 -2px 0 var(--analyzer-mana2),
			0 0 0 2px var(--accent);
	}

	.analyzer-tabs--toolbar .analyzer-tab--selected {
		font-weight: 600;
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		border-color: var(--border);
	}

	.analyzer-tabs--toolbar .analyzer-tab--cmini.analyzer-tab--selected {
		color: var(--analyzer-cmini);
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cmini) 14%, var(--bg-primary));
	}

	.analyzer-tabs--toolbar .analyzer-tab--cyanophage.analyzer-tab--selected {
		color: var(--analyzer-cyanophage);
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cyanophage) 14%, var(--bg-primary));
	}

	.analyzer-tabs--toolbar .analyzer-tab--mana2.analyzer-tab--selected {
		color: var(--analyzer-mana2);
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-mana2) 14%, var(--bg-primary));
	}

	.analyzer-tab-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 9999px;
		background-color: var(--filter-active-dot);
		flex-shrink: 0;
	}

	.analyzer-tab--cmini .analyzer-tab-dot {
		background-color: var(--analyzer-cmini);
	}

	.analyzer-tab--cyanophage .analyzer-tab-dot {
		background-color: var(--analyzer-cyanophage);
	}

	.analyzer-tab--mana2 .analyzer-tab-dot {
		background-color: var(--analyzer-mana2);
	}

	.analyzer-tab-sr {
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

	@container (max-width: 36rem) {
		.analyzer-tabs--toolbar {
			display: grid;
			flex: 1 1 auto;
			min-width: 0;
		}

		.analyzer-tabs--toolbar .analyzer-tab {
			min-width: 0;
		}
	}
</style>
