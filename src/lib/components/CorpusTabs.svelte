<script lang="ts">
	import { isStatsCorpus, STAT_CORPORA, type StatsCorpus } from '$lib/statsAnalyzers';

	interface Props {
		value: StatsCorpus;
		onChange: (value: StatsCorpus) => void;
	}

	const { value, onChange }: Props = $props();

	function handleChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value;
		if (!isStatsCorpus(next)) return;
		onChange(next);
	}
</script>

<select class="corpus-tabs" aria-label="Corpus" {value} onchange={handleChange}>
	{#each STAT_CORPORA as corpus (corpus.value)}
		<option value={corpus.value}>{corpus.label}</option>
	{/each}
</select>

<style>
	.corpus-tabs {
		flex-shrink: 0;
		field-sizing: content;
		max-width: min(12rem, 50vw);
		min-width: 0;
		/* ~26.4px: 0.3125rem*2 padding + 2px border + 0.75rem*1.2 line-height */
		padding: 0.3125rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.75rem;
		line-height: 1.2;
		outline: none;
		cursor: pointer;
		transition: box-shadow 0.15s ease;
	}

	.corpus-tabs:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}
</style>
